import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { viewAs } from "./views.js";

const requirement = (page: Page, title: string) =>
  page.getByRole("article", { name: title, exact: true });

test("switching views preserves the customer and can return to the manager queue", async ({
  page,
}) => {
  await page.goto("/onboardings/beacon");
  await expect(page.getByRole("heading", { name: "Beacon Supply", exact: true })).toBeVisible();
  await expect(
    page.getByRole("group", { name: "View as", exact: true }).getByRole("button"),
  ).toHaveText(["Account manager", "Reviewer", "Customer"]);
  const reviewer = page.getByRole("button", { name: "Reviewer", exact: true });
  await reviewer.focus();
  await page.keyboard.press("Enter");
  await expect(reviewer).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Account manager", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("heading", { name: "Beacon Supply", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/onboardings\/beacon$/);
  await viewAs(page, "customer");
  await expect(page.getByRole("heading", { name: "Beacon Supply", exact: true })).toBeVisible();
  await expect(page.getByLabel("Customer account", { exact: true })).toHaveValue("beacon");
  await viewAs(page, "customer", "cedar");
  await expect(page.getByRole("heading", { name: "Cedar & Co", exact: true })).toBeVisible();
  await viewAs(page, "reviewer");
  await expect(page.getByRole("heading", { name: "Cedar & Co", exact: true })).toBeVisible();
  await viewAs(page, "customer");
  await page.getByRole("button", { name: "Back to account manager", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Keep every launch moving.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Juniper Retail/ }).click();
  await expect(page.getByRole("heading", { name: "Juniper Retail", exact: true })).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Keep every launch moving.", exact: true }),
  ).toBeVisible();
});

test("the static demo completes an empty checklist, correction, downloads and activation without an API", async ({
  page,
  context,
}) => {
  const apiRequests: string[] = [];
  const errors: string[] = [];
  await context.route("**/api/**", (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("Interactive browser demo", { exact: true })).toBeVisible();
  await viewAs(page, "customer", "beacon");
  await expect(page.getByRole("heading", { name: "Beacon Supply", exact: true })).toBeVisible();
  for (const [title, fields] of [
    [
      "Company details",
      { "Legal company name": "Beacon Supply Ltd", "Registered address": "42 Harbour Road" },
    ],
    [
      "Launch contact",
      { "Launch contact name": "Owen Reed", "Launch contact email": "owen@beacon.test" },
    ],
  ] as const) {
    const item = requirement(page, title);
    await item.getByRole("button", { name: "Add details", exact: true }).click();
    for (const [label, value] of Object.entries(fields))
      await item.getByLabel(label, { exact: true }).fill(value);
    await item.getByRole("button", { name: "Submit for review", exact: true }).click();
    await expect(item.getByText("In review", { exact: true })).toBeVisible();
  }
  for (const [title, label, fixture] of [
    ["Sample import file", /CSV sample import/, "fixtures/sample-import.csv"],
    ["Service agreement", /PDF agreement/, "fixtures/service-agreement.pdf"],
  ] as const) {
    const item = requirement(page, title);
    await item.getByRole("button", { name: "Upload document", exact: true }).click();
    await item.getByLabel(label).setInputFiles(fixture);
    await item.getByRole("button", { name: "Submit for review", exact: true }).click();
    await expect(item.getByText("In review", { exact: true })).toBeVisible();
  }
  await viewAs(page, "reviewer");
  for (const title of ["Company details", "Sample import file", "Launch contact"]) {
    const item = requirement(page, title);
    await item.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(item.getByText("Approved", { exact: true })).toBeVisible();
  }
  const agreement = requirement(page, "Service agreement");
  await agreement.getByLabel("Correction reason").fill("Include the signed final page.");
  await agreement.getByRole("button", { name: "Request correction", exact: true }).click();
  await expect(agreement.getByText("Needs correction", { exact: true })).toBeVisible();
  await viewAs(page, "customer");
  await expect(
    agreement.getByText("Include the signed final page.", { exact: true }),
  ).toBeVisible();
  await agreement.getByRole("button", { name: "Replace document", exact: true }).click();
  await agreement.getByLabel(/PDF agreement/).setInputFiles("fixtures/service-agreement.pdf");
  await agreement.getByRole("button", { name: "Submit for review", exact: true }).click();
  await expect(agreement.getByText("In review", { exact: true })).toBeVisible();
  await viewAs(page, "reviewer");
  await agreement.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Ready to activate", { exact: true })).toBeVisible();
  await agreement.getByText("2 submission revisions", { exact: true }).click();
  await expect(agreement.getByText(/Needs correction by Noah Ellis/)).toBeVisible();
  await viewAs(page, "manager");
  await page.getByRole("button", { name: "Activate account", exact: true }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await viewAs(page, "customer");
  await expect(page.getByRole("button", { name: /Replace document|Update details/ })).toHaveCount(
    0,
  );
  for (const filename of ["service-agreement.pdf", "sample-import.csv"]) {
    const event = page.waitForEvent("download");
    await page.getByRole("link", { name: `Download ${filename}`, exact: true }).click();
    const download = await event;
    const file = await download.path();
    if (!file) throw new Error("Demo download did not finish");
    expect(await readFile(file)).toEqual(await readFile(`fixtures/${filename}`));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("tabs, refresh and reset restore independent fixtures; scope and reminders remain usable", async ({
  page,
  context,
}) => {
  const apiRequests: string[] = [];
  await context.route("**/api/**", (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto("/onboardings/cedar");
  await expect(page.getByRole("heading", { name: "Cedar & Co", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activate account", exact: true })).toHaveCSS(
    "cursor",
    "pointer",
  );
  const seededDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download service-agreement.pdf", exact: true }).click();
  const seededFile = await (await seededDownload).path();
  if (!seededFile) throw new Error("Sample document download did not finish");
  expect(await readFile(seededFile)).toEqual(await readFile("fixtures/service-agreement.pdf"));
  await page.getByRole("button", { name: "Activate account", exact: true }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  const other = await context.newPage();
  try {
    await other.goto("/onboardings/cedar");
    await expect(
      other.getByRole("button", { name: "Activate account", exact: true }),
    ).toBeEnabled();
  } finally {
    await other.close();
  }
  await page.reload();
  await expect(page.getByRole("button", { name: "Activate account", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Advance 24 hours", exact: true }).click();
  await expect(page.getByText("Workspace demo date: 2026-10-16", { exact: true })).toBeVisible();
  await expect(page.locator('time[datetime="2026-10-16"]')).toBeVisible();
  await viewAs(page, "customer", "beacon");
  await page.evaluate(() => {
    history.pushState({}, "", "/onboardings/juniper");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page.getByRole("heading", { name: "Onboarding unavailable", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account manager", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Workspace demo date: 2026-10-15", { exact: true })).toBeVisible();
  await page.getByLabel("Account manager", { exact: true }).selectOption("oliver");
  await expect(page.getByRole("button", { name: /Cedar & Co/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Lumen Home/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Juniper Retail/ })).toHaveCount(0);
  await page.getByRole("link", { name: "View onboarding for Juniper Retail", exact: true }).click();
  await expect(page).toHaveURL(/\/onboardings\/juniper$/);
  await expect(page.getByRole("heading", { name: "Juniper Retail", exact: true })).toBeVisible();
  await expect(page.locator("#main-content")).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const blockedActivation = page.getByRole("button", { name: "Activate account", exact: true });
  await expect(blockedActivation).toBeDisabled();
  await blockedActivation.hover();
  await expect(blockedActivation).toHaveCSS("cursor", "not-allowed");
  expect(apiRequests).toEqual([]);
});
