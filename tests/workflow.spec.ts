import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { actorSchema, detailSchema } from "../packages/contracts/src/index.js";

async function persona(page: Page, id: string) {
  await page.getByLabel("Demo persona").selectOption(id);
  await expect
    .poll(async () => {
      const response = await page.request.get("/api/session");
      return response.ok() ? actorSchema.assert(await response.json()).membershipId : null;
    })
    .toBe(id);
  await expect(page.getByLabel("Demo persona")).toHaveValue(id);
}
const agreement = (page: Page) =>
  page.getByRole("article", { name: "Service agreement", exact: true });
async function openJuniper(page: Page) {
  await page.getByRole("button", { name: /Juniper Retail/ }).click();
  await expect(page.getByRole("heading", { name: "Juniper Retail", exact: true })).toBeVisible();
}
async function upload(page: Page) {
  await agreement(page).getByRole("button", { name: "Replace document" }).click();
  await agreement(page)
    .getByLabel(/PDF agreement/)
    .setInputFiles("fixtures/service-agreement.pdf");
  await agreement(page).getByRole("button", { name: "Submit for review" }).click();
  await expect(agreement(page).getByText("In review", { exact: true })).toBeVisible();
}

test("unrelated customers and workspaces cannot read details or private files", async ({
  page,
}) => {
  await page.goto("/");
  await persona(page, "ada");
  await openJuniper(page);
  await persona(page, "owen");
  await expect(page.getByRole("heading", { name: "Beacon Supply", exact: true })).toBeVisible();
  for (const id of ["owen", "iris"]) {
    await persona(page, id);
    expect((await page.request.get("/api/onboardings/juniper")).status()).toBe(404);
    expect((await page.request.get("/api/revisions/juniper-agreement-seed-1/file")).status()).toBe(
      404,
    );
    await page.goto("/onboardings/juniper");
    await expect(page.getByRole("heading", { name: "Onboarding unavailable" })).toBeVisible();
    await page.getByRole("button", { name: "Return to your workspace" }).click();
    await expect(page.getByRole("heading", { name: "Onboarding unavailable" })).toHaveCount(0);
  }
});

test("a document correction reaches activation and keeps its private history", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await persona(page, "maya");
  await expect(
    agreement(page).getByText("Include the signed final page.", { exact: true }),
  ).toBeVisible();
  await upload(page);
  await persona(page, "noah");
  await openJuniper(page);
  await agreement(page).getByLabel("Correction reason").fill("Use the final signed copy.");
  await agreement(page).getByRole("button", { name: "Request correction" }).click();
  await expect(agreement(page).getByText("Needs correction", { exact: true })).toBeVisible();
  await persona(page, "maya");
  await expect(
    agreement(page).getByText("Use the final signed copy.", { exact: true }),
  ).toBeVisible();
  await upload(page);
  await persona(page, "noah");
  await openJuniper(page);
  await agreement(page).getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Ready to activate", { exact: true })).toBeVisible();
  await agreement(page).getByText("3 submission revisions", { exact: true }).click();
  await expect(
    agreement(page).getByText(/Needs correction by Noah Ellis. Use the final signed copy./),
  ).toBeVisible();
  await persona(page, "ada");
  await openJuniper(page);
  await page.getByRole("button", { name: "Activate account", exact: true }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await persona(page, "maya");
  await expect(page.getByRole("button", { name: /Replace document|Update details/ })).toHaveCount(
    0,
  );
  const response = await page.request.get("/api/onboardings/juniper");
  const detail = detailSchema.assert(await response.json());
  const current = detail.revisions.find(
    (item) =>
      item.id === detail.requirements.find((item) => item.kind === "agreement")?.currentRevisionId,
  );
  expect(current).toBeDefined();
  const file = await page.request.get(`/api/revisions/${current?.id}/file`);
  expect(file.status()).toBe(200);
  expect(await file.body()).toEqual(await readFile("fixtures/service-agreement.pdf"));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});
