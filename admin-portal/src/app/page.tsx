import Link from 'next/link';
import { Briefcase, Users } from 'lucide-react';

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/jobs"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Scrapped Jobs</h2>
              <p className="text-gray-600">View and search all scraped job listings</p>
            </div>
          </div>
        </Link>
        <Link
          href="/bot-users"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Bot Users</h2>
              <p className="text-gray-600">View and manage WhatsApp bot users</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
