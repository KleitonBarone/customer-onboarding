import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { detailSchema } from "../packages/contracts/src/index.js";
import { viewAs } from "./views.js";

const agreement = (page: Page) =>
  page.getByRole("article", { name: "Service agreement", exact: true });
async function openOnboarding(page: Page, company: string) {
  await page.getByRole("button", { name: new RegExp(company) }).click();
  await expect(page.getByRole("heading", { name: company, exact: true })).toBeVisible();
}
async function upload(
  page: Page,
  title: "Service agreement" | "Sample import file" = "Service agreement",
) {
  const item = page.getByRole("article", { name: title, exact: true });
  await item.getByRole("button", { name: /Upload document|Replace document/ }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const file = item.getByLabel(
    title === "Service agreement" ? /PDF agreement/ : /CSV sample import/,
  );
  await expect(file).toBeFocused();
  await file.setInputFiles(
    title === "Service agreement" ? "fixtures/service-agreement.pdf" : "fixtures/sample-import.csv",
  );
  await item.getByRole("button", { name: "Submit for review" }).click();
  await expect(item.getByText("In review", { exact: true })).toBeVisible();
}

async function submitDetails(page: Page, title: string, fields: Record<string, string>) {
  const item = page.getByRole("article", { name: title, exact: true });
  await item.getByRole("button", { name: "Add details" }).click();
  for (const [label, value] of Object.entries(fields))
    await item.getByLabel(label, { exact: true }).fill(value);
  await item.getByRole("button", { name: "Submit for review" }).click();
  await expect(item.getByText("In review", { exact: true })).toBeVisible();
}

test("unrelated customers and workspaces cannot read details or private files", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.route("**/api/onboardings?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Queue temporarily unavailable." }),
    }),
  );
  await viewAs(page, "manager");
  await expect(page.getByRole("alert")).toContainText("Queue temporarily unavailable.", {
    timeout: 12000,
  });
  await page.unroute("**/api/onboardings?**");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("button", { name: /Juniper Retail/ })).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("ready");
  await expect(page.getByRole("button", { name: /Cedar & Co/ })).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("");
  await page.getByLabel("Account manager", { exact: true }).selectOption("oliver");
  await expect(page.getByRole("button", { name: /Cedar & Co/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Lumen Home/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Juniper Retail/ })).toHaveCount(0);
  await page.getByLabel("Account manager", { exact: true }).selectOption("");
  await openOnboarding(page, "Juniper Retail");
  await page.route("**/api/demo/session", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Could not switch views. Please try again." }),
    }),
  );
  await page.getByLabel("View as", { exact: true }).selectOption("reviewer");
  await expect(page.getByRole("alert")).toContainText("Could not switch views. Please try again.");
  await expect(page.getByLabel("View as", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("View as", { exact: true })).toHaveValue("manager");
  await expect(page.getByRole("heading", { name: "Juniper Retail", exact: true })).toBeVisible();
  await page.unroute("**/api/demo/session");
  await viewAs(page, "reviewer");
  await expect(page.getByRole("heading", { name: "Juniper Retail", exact: true })).toBeVisible();
  await viewAs(page, "customer", "beacon");
  await expect(page.getByRole("heading", { name: "Beacon Supply", exact: true })).toBeVisible();
  for (const id of ["owen", "iris"]) {
    // These identities remain API fixtures; the UI exposes roles and companies.
    const switched = await page.request.post("/api/demo/session", { data: { membershipId: id } });
    expect(switched.status()).toBe(200);
    await page.reload();
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

test("an empty checklist reaches activation through document correction and keeps its private history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await viewAs(page, "customer", "beacon");
  await expect(page.getByRole("heading", { name: "Beacon Supply", exact: true })).toBeVisible();
  await submitDetails(page, "Company details", {
    "Legal company name": "Beacon Supply Ltd",
    "Registered address": "42 Harbour Road, Bristol",
  });
  await submitDetails(page, "Launch contact", {
    "Launch contact name": "Owen Reed",
    "Launch contact email": "owen@beacon.test",
  });
  await upload(page, "Sample import file");
  await upload(page);
  await viewAs(page, "reviewer");
  for (const title of ["Company details", "Sample import file", "Launch contact"]) {
    const item = page.getByRole("article", { name: title, exact: true });
    await item.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(item.getByText("Approved", { exact: true })).toBeVisible();
  }
  await agreement(page).getByLabel("Correction reason").fill("Use the final signed copy.");
  await agreement(page).getByRole("button", { name: "Request correction" }).click();
  await expect(agreement(page).getByText("Needs correction", { exact: true })).toBeVisible();
  await viewAs(page, "customer");
  await expect(
    agreement(page).getByText("Use the final signed copy.", { exact: true }),
  ).toBeVisible();
  await upload(page);
  await viewAs(page, "reviewer");
  await agreement(page).getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Ready to activate", { exact: true })).toBeVisible();
  await agreement(page).getByText("2 submission revisions", { exact: true }).click();
  await expect(
    agreement(page).getByText(/Needs correction by Noah Ellis. Use the final signed copy./),
  ).toBeVisible();
  await viewAs(page, "manager");
  await page.getByRole("button", { name: "Activate account", exact: true }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await viewAs(page, "customer");
  await expect(page.getByRole("button", { name: /Replace document|Update details/ })).toHaveCount(
    0,
  );
  const response = await page.request.get("/api/onboardings/beacon");
  const detail = detailSchema.assert(await response.json());
  const current = detail.revisions.find(
    (item) =>
      item.id === detail.requirements.find((item) => item.kind === "agreement")?.currentRevisionId,
  );
  expect(current).toBeDefined();
  const file = await page.request.get(`/api/revisions/${current?.id}/file`);
  expect(file.status()).toBe(200);
  expect(await file.body()).toEqual(await readFile("fixtures/service-agreement.pdf"));
  const csv = detail.revisions.find((item) => item.fileName === "sample-import.csv");
  expect(csv).toBeDefined();
  const csvFile = await page.request.get(`/api/revisions/${csv?.id}/file`);
  expect(csvFile.status()).toBe(200);
  expect(await csvFile.body()).toEqual(await readFile("fixtures/sample-import.csv"));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});
