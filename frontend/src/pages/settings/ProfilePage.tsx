import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi, getApiError } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";

export default function ProfilePage() {
  const setUser = useAuthStore((s) => s.setUser);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => authApi.me() });
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => authApi.profile() });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [userForm, setUserForm] = useState({ first_name: "", last_name: "", email: "" });
  const [profile, setProfile] = useState({
    phone: "",
    bio: "",
    certifications: "",
    specialties: "",
    years_experience: "0",
    license_number: "",
  });

  useEffect(() => {
    if (meQ.data) {
      setUserForm({
        first_name: meQ.data.first_name,
        last_name: meQ.data.last_name,
        email: meQ.data.email,
      });
    }
  }, [meQ.data]);
  useEffect(() => {
    if (profileQ.data) {
      setProfile({
        phone: profileQ.data.phone ?? "",
        bio: profileQ.data.bio ?? "",
        certifications: profileQ.data.certifications ?? "",
        specialties: profileQ.data.specialties ?? "",
        years_experience: String(profileQ.data.years_experience ?? 0),
        license_number: profileQ.data.license_number ?? "",
      });
    }
  }, [profileQ.data]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const user = await authApi.patchMe(userForm);
      setUser(user);
      await authApi.patchProfile({
        ...profile,
        years_experience: Number(profile.years_experience),
      });
      setSaved(true);
    } catch (err) {
      setError(getApiError(err));
    }
  };

  return (
    <div className="page">
      <PageHeader title="Farmer profile" subtitle="How you show up to the rest of the crew." />
      <ErrorBanner message={error} />
      {saved ? <p className="muted">Saved.</p> : null}
      <form className="card card-pad" style={{ maxWidth: 720 }} onSubmit={onSubmit}>
        <div className="grid grid-2">
          <FormField label="First name" htmlFor="pfn">
            <input id="pfn" className="input" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} />
          </FormField>
          <FormField label="Last name" htmlFor="pln">
            <input id="pln" className="input" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Email" htmlFor="pemail">
          <input id="pemail" className="input" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
        </FormField>
        <FormField label="Phone" htmlFor="pphone">
          <input id="pphone" className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
        </FormField>
        <FormField label="Certifications" htmlFor="pcert" hint="CCA, pesticide applicator, organic, etc.">
          <input id="pcert" className="input" value={profile.certifications} onChange={(e) => setProfile({ ...profile, certifications: e.target.value })} />
        </FormField>
        <FormField label="Specialties" htmlFor="pspec" hint="Irrigation, agronomy, livestock, grain.">
          <input id="pspec" className="input" value={profile.specialties} onChange={(e) => setProfile({ ...profile, specialties: e.target.value })} />
        </FormField>
        <div className="grid grid-2">
          <FormField label="Years experience" htmlFor="pexp">
            <input
              id="pexp"
              className="input"
              type="number"
              value={profile.years_experience}
              onChange={(e) => setProfile({ ...profile, years_experience: e.target.value })}
            />
          </FormField>
          <FormField label="License number" htmlFor="plic">
            <input id="plic" className="input" value={profile.license_number} onChange={(e) => setProfile({ ...profile, license_number: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Bio" htmlFor="pbio">
          <textarea id="pbio" className="textarea" value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
        </FormField>
        <button type="submit" className="btn btn-primary">
          Save profile
        </button>
      </form>
    </div>
  );
}
