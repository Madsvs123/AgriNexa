import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/FormField";

export default function NotFoundPage() {
  return (
    <div className="page">
      <PageHeader title="Field not on the map" subtitle="That route is fallow — nothing is planted here." />
      <div className="card card-pad" style={{ maxWidth: 480 }}>
        <div className="empty-art" />
        <p>The page you requested is not part of AgriNexa operations.</p>
        <Link to="/home" className="btn btn-primary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
