import { Elysia } from "elysia";
import { cron } from '@elysiajs/cron'
import { SociumScraper } from "./scrapers/SociumScraper";
import { DjamoScraper } from "./scrapers/DjamoScraper";
import { EduCarriereScraper } from "./scrapers/EduCarriereScraper";
import { OptionCarriereScraper } from "./scrapers/OptionCarriereScraper";
import { JobIvoireScraper } from "./scrapers/JobIvoireScraper";
import { ProJobIvoireScraper } from "./scrapers/ProJobIvoireScraper";

let i = 0;
const app = new Elysia()

  .get("/", () => {
    const e = new ProJobIvoireScraper();
    e.scrape(2).then(jobs => {
      console.log('Scraped jobs:', jobs);
    })

    return "Hello Elysia ecosystem!";
  }).listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
