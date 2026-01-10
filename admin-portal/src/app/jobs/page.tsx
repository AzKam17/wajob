'use client';

import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { SidePanel, DetailRow } from '@/components/SidePanel';
import { fetchJobs } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Job {
  id: string;
  title: string;
  company?: string;
  location?: string;
  description?: string;
  url: string;
  postedDate: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

const columns = [
  {
    key: 'title',
    header: 'Title',
  },
  {
    key: 'company',
    header: 'Company',
  },
  {
    key: 'location',
    header: 'Location',
  },
  {
    key: 'source',
    header: 'Source',
  },
  {
    key: 'postedDate',
    header: 'Posted Date',
    render: (value: string) => formatDate(value),
  },
];

export default function JobsPage() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Scrapped Jobs</h1>
      <DataTable
        columns={columns}
        fetchData={fetchJobs}
        searchPlaceholder="Search jobs by title, company, location..."
        onRowClick={(job) => setSelectedJob(job as Job)}
      />

      <SidePanel
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title="Job Details"
      >
        {selectedJob && (
          <dl className="space-y-1">
            <DetailRow label="Title" value={selectedJob.title} />
            <DetailRow label="Company" value={selectedJob.company} />
            <DetailRow label="Location" value={selectedJob.location} />
            <DetailRow label="Source" value={selectedJob.source} />
            <DetailRow
              label="Posted Date"
              value={formatDate(selectedJob.postedDate)}
            />
            <DetailRow
              label="Description"
              value={
                selectedJob.description ? (
                  <div className="whitespace-pre-wrap text-sm max-h-64 overflow-y-auto">
                    {selectedJob.description}
                  </div>
                ) : '-'
              }
            />
            <DetailRow
              label="URL"
              value={
                <a
                  href={selectedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {selectedJob.url}
                </a>
              }
            />
            <DetailRow label="ID" value={<span className="font-mono text-xs">{selectedJob.id}</span>} />
            <DetailRow
              label="Created At"
              value={formatDate(selectedJob.createdAt, true)}
            />
            <DetailRow
              label="Updated At"
              value={formatDate(selectedJob.updatedAt, true)}
            />
          </dl>
        )}
      </SidePanel>
    </div>
  );
}
