import PayoutsTable from "./payouts-table";

export default function AdminPayoutsPage() {
  return (
    <div>
      <h2 style={{ fontSize: "1.05rem" }}>Ödeme Talepleri</h2>
      <PayoutsTable />
    </div>
  );
}
