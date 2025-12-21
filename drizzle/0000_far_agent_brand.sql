CREATE TABLE `job_ads` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`posted_date` integer NOT NULL,
	`source` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_ads_url_unique` ON `job_ads` (`url`);--> statement-breakpoint
CREATE TABLE `scraper_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`last_scraped_at` integer,
	`last_page_scrapped` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`should_scrape_next` integer DEFAULT false NOT NULL,
	`scrape_interval` integer,
	`max_pages` integer,
	`total_jobs_found` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scraper_sources_name_unique` ON `scraper_sources` (`name`);--> statement-breakpoint
CREATE TABLE `scrape_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`source_id` text NOT NULL,
	`source_name` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`pages_scraped` integer DEFAULT 0 NOT NULL,
	`jobs_found` integer DEFAULT 0 NOT NULL,
	`errors` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`source_id`) REFERENCES `scraper_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scrape_sessions_session_id_unique` ON `scrape_sessions` (`session_id`);