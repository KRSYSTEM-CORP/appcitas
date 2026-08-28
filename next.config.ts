import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "kr-system",
  project: "krcitas",
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
