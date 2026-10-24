import { contact } from "@/content/home";
import { site } from "@/content/site";

export function Footer() {
  return (
    <footer className="px-4 pt-6 pb-10 text-center text-xs text-body/80 sm:px-6">
      © {new Date().getFullYear()} {site.name} · {contact.footer}
    </footer>
  );
}
