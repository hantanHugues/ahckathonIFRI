import { Link } from "wouter";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-neutral-light py-3 px-4">
      <div className="flex flex-col md:flex-row justify-between items-center">
        <div className="text-sm text-neutral-dark">
          &copy; {currentYear} SensMed - Monitoring des Patients
        </div>
        <div className="text-sm text-neutral-dark mt-2 md:mt-0">
          Version 1.0.0 | 
          <Link href="/settings" className="text-primary hover:text-primary-dark ml-1">
            Aide
          </Link> | 
          <Link href="/settings" className="text-primary hover:text-primary-dark ml-1">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
