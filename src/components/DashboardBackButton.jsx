import './DashboardBackButton.css';
export default function DashboardBackButton({ onClick }) {
  return <button className="dashboard-back-button" type="button" onClick={onClick}>← Back to dashboard</button>;
}
