import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/FormField";

const LINKS = [
  { to: "/settings/organization", title: "Organization", body: "Name, units, currency, and map defaults." },
  { to: "/settings/team", title: "Team", body: "Members, teams, and role assignments." },
  { to: "/settings/roles", title: "Roles", body: "Permission checkboxes for operations." },
  { to: "/settings/invitations", title: "Invitations", body: "Invite agronomists and operators by email." },
  { to: "/settings/access", title: "Farm access", body: "Who can view, edit, or manage each farm." },
  { to: "/settings/profile", title: "Farmer profile", body: "Certifications, specialties, and experience." },
];

export default function SettingsPage() {
  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Organization, people, and access." />
      <div className="grid grid-3">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="card card-pad">
            <h3>{l.title}</h3>
            <p className="muted">{l.body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
