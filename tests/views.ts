import { expect, type Page } from "@playwright/test";
import type { Actor } from "../packages/contracts/src/index.js";

export async function viewAs(page: Page, role: Actor["role"], customerId?: string) {
  const names = { manager: "Account manager", reviewer: "Reviewer", customer: "Customer" };
  const view = page
    .getByRole("group", { name: "View as", exact: true })
    .getByRole("button", { name: names[role], exact: true });
  await expect(view).toBeEnabled();
  if ((await view.getAttribute("aria-pressed")) !== "true") await view.click();
  await expect(view).toHaveAttribute("aria-pressed", "true");
  await expect(view).toBeEnabled();
  if (role === "customer" && customerId) {
    const account = page.getByLabel("Customer account", { exact: true });
    if ((await account.inputValue()) !== customerId) await account.selectOption(customerId);
    await expect(account).toHaveValue(customerId);
    await expect(account).toBeEnabled();
  }
}
