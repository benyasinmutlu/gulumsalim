import OrdersTable from "./orders-table";

export default function VendorOrdersPage() {
  return (
    <div>
      <h2 style={{ fontSize: "1.05rem" }}>Siparişlerim</h2>
      <OrdersTable />
    </div>
  );
}
