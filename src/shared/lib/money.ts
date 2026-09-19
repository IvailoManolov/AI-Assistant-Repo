/** Every amount in the product is EUR, formatted in one place. */
export const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
