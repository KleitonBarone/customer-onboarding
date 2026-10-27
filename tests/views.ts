import { expect, type Page } from "@playwright/test";
import type { Actor } from "../packages/contracts/src/index.js";

export async function viewAs(page: Page, role: Actor["role"], customerId?: string) {
  const view = page.getByLabel("View as", { exact: true });
  if ((await view.inputValue()) !== role) await view.selectOption(role);
  await expect(view).toHaveValue(role);
  await expect(view).toBeEnabled();
  if (role === "customer" && customerId) {
    const account = page.getByLabel("Customer account", { exact: true });
    if ((await account.inputValue()) !== customerId) await account.selectOption(customerId);
    await expect(account).toHaveValue(customerId);
    await expect(account).toBeEnabled();
  }
}
