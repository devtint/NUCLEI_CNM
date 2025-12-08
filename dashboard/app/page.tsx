import fs from "fs";
import path from "path";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default function Home() {
  const scansDir = path.join(process.cwd(), "scans");
  let totalScans = 0;
  let lastScan = "Never";

  try {
    if (fs.existsSync(scansDir)) {
      const files = fs.readdirSync(scansDir).filter(f => f.endsWith(".json"));
      totalScans = files.length;
      if (files.length > 0) {
        const latest = files.map(f => {
          const stat = fs.statSync(path.join(scansDir, f));
          return { file: f, mtime: stat.mtimeMs };
        }).sort((a, b) => b.mtime - a.mtime)[0];

        lastScan = new Date(latest.mtime).toLocaleString();
      }
    }
  } catch (e) {
    console.error("Error reading stats", e);
  }

  // Pure wrapper, styles moved to DashboardClient
  return (
    <>

      <DashboardClient initialStats={{ totalScans, lastScan }} />
    </>
  );
}
