import FiscalMetricPage from "../_components/FiscalMetricPage";

export default function Page() {
  return (
    <FiscalMetricPage
      endpoint="/api/fiscal/revenue"
      defaultCountry="PAK"
      defaultTop={80}
      defaultFrom={2000}
      defaultTo={2030}
      defaultYear="2024"
    />
  );
}
