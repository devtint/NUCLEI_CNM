"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Loader2, ShieldAlert, Terminal, AlertTriangle, RefreshCw, Crosshair, Search, Copy } from "lucide-react";
import { toast } from "sonner";

export function ShodanEnrichment({ ip: rawIp }: { ip: string }) {
    // Parse potentially arrayified IPs into a single valid IPv4
    let ip = rawIp;
    if (rawIp && rawIp.startsWith("[") && rawIp.includes('"')) {
        try {
            const parsed = JSON.parse(rawIp);
            if (Array.isArray(parsed) && parsed.length > 0) {
                ip = parsed[0];
            }
        } catch {
            // ignore JSON parse fail
        }
    }

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [launching, setLaunching] = useState(false);
    const [unmasking, setUnmasking] = useState(false);
    const [unmaskedData, setUnmaskedData] = useState<any[]>([]);

    const enrich = async (force: boolean = false) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/shodan/host", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ip, force })
            });
            const result = await res.json();
            if (result.success) {
                setData(result.data);
                if (result.cached) toast.success("Loaded from Shodan Cache ⚡");
                else toast.success("Enriched via Shodan API!");
            } else {
                setError(result.error);
                toast.error(result.error || "Failed to fetch Shodan data");
            }
        } catch (e: any) {
            setError(e.message || "Network Error");
            toast.error("Network Error");
        } finally {
            setLoading(false);
        }
    };

    const copyNucleiCommand = async () => {
        if (!data?.vulns) return;
        const cves = (Array.isArray(data.vulns) ? data.vulns : Object.keys(data.vulns)).join(",");
        const cmd = `nuclei -u http://${ip} -id ${cves}`;
        try {
            await navigator.clipboard.writeText(cmd);
            toast.success("Copied Nuclei command to clipboard!");
        } catch (err) {
            toast.error("Failed to copy command");
        }
    };

    const launchNucleiScan = async () => {
        if (!data?.vulns) return;
        const cves = (Array.isArray(data.vulns) ? data.vulns : Object.keys(data.vulns)).join(",");
        if (!cves) return;

        setLaunching(true);
        try {
            const res = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target: ip.includes(":") ? ip : `http://${ip}`,
                    targetMode: 'url',
                    customArgs: `-id ${cves}`,
                })
            });
            const result = await res.json();
            if (result.success) {
                toast.success("Live Nuclei verification launched successfully!");
            } else {
                toast.error(result.error || "Failed to launch scan");
            }
        } catch (e) {
            toast.error("Network Error when launching scan");
        } finally {
            setLaunching(false);
        }
    };

    const unmaskOrigin = async () => {
        // Find favicon hash or SSL in current shodan data port scan array
        let faviconHash = null;
        let sslSubject = null;
        if (data?.data && Array.isArray(data.data)) {
            for (const portData of data.data) {
                if (portData.http?.favicon?.hash) faviconHash = portData.http.favicon.hash;
                if (portData.ssl?.cert?.subject?.CN) sslSubject = portData.ssl.cert.subject.CN;
            }
        }

        let query = "";
        if (faviconHash) {
            query = `http.favicon.hash:${faviconHash} -org:"Cloudflare"`;
        } else if (sslSubject) {
            query = `ssl.cert.subject.CN:"${sslSubject}" -org:"Cloudflare"`;
        } else {
            toast.error("No Favicon or SSL Subject found on this IP mapping to pivot from.");
            return;
        }

        setUnmasking(true);
        try {
            const res = await fetch("/api/shodan/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query })
            });
            const result = await res.json();
            if (result.success && result.data?.matches) {
                setUnmaskedData(result.data.matches);
                if (result.data.matches.length > 0) {
                    toast.success(`Found ${result.data.matches.length} potential origin servers!`);
                } else {
                    toast.error("Query returned 0 origin IPs using available WAF bypass fingerprints.");
                }
            } else {
                toast.error(result.error || "No origin servers found");
            }
        } catch (e: any) {
            toast.error("Network Error: " + e.message);
        } finally {
            setUnmasking(false);
        }
    };

    const copyUnmaskedIps = async () => {
        if (!unmaskedData || unmaskedData.length === 0) return;
        const ips = unmaskedData.map(match => match.ip_str).join("\n");
        try {
            await navigator.clipboard.writeText(ips);
            toast.success(`Copied ${unmaskedData.length} origin IPs to clipboard!`);
        } catch (err) {
            toast.error("Failed to copy IPs");
        }
    };

    const isCDN = data?.org?.toLowerCase().includes("cloudflare") || data?.isp?.toLowerCase().includes("cloudflare") ||
        data?.org?.toLowerCase().includes("fastly") || data?.isp?.toLowerCase().includes("fastly");

    if (!ip || ip.trim() === "" || ip === "-" || ip === "[]" || ip === '""') return null;

    return (
        <Card className="overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none z-0">
                <Zap className="h-40 w-40 text-muted-foreground" />
            </div>

            <CardHeader className="pb-3 border-b items-start justify-between flex-row relative z-10">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Shodan Infrastructure Intel
                    </CardTitle>
                    <CardDescription className="mt-1">Deep threat intelligence for IP: <span className="font-mono text-foreground">{ip}</span></CardDescription>
                </div>
                {!data && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-500 hover:text-amber-600 border-amber-500/20 hover:bg-amber-500/10 transition-all font-medium"
                        onClick={() => enrich(false)}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                        {loading ? 'Enriching...' : 'Enrich with Shodan'}
                    </Button>
                )}
                {data && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-muted-foreground hover:text-foreground border-border hover:bg-muted/50 transition-all font-medium"
                        onClick={() => enrich(true)}
                        disabled={loading}
                        title="Force a real scan (Bypasses Cache)"
                    >
                        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        {loading ? 'Rescanning...' : 'Rescan'}
                    </Button>
                )}
            </CardHeader>

            <CardContent className="p-4 relative z-10">
                {error && <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 p-3 rounded-md mb-2">{error}</div>}

                {!data && !error && !loading && (
                    <div className="text-sm text-muted-foreground flex items-center justify-center p-6 bg-muted/30 rounded-lg border border-dashed border-border m-2 mt-0">
                        Click enrich to fetch real-time ports, vulnerabilities, and ISP intel. (Only costs 1 API Credit or loads from Local Cache instantly).
                    </div>
                )}

                {loading && !data && (
                    <div className="flex flex-col items-center justify-center p-8 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-amber-500 opacity-80" />
                        <span className="text-xs text-muted-foreground animate-pulse">Querying Global Threat Intel...</span>
                    </div>
                )}

                {data && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2 animate-in fade-in duration-500">
                        {/* Host Details */}
                        <div className="space-y-4">
                            <div className="bg-muted bg-opacity-50 p-4 rounded-lg border border-border space-y-4">
                                <div>
                                    <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">Organization / ISP</h4>
                                    <div className="text-sm font-medium text-foreground">{data.org || data.isp || "Unknown Provider"}</div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">Operating System</h4>
                                        <div className="text-sm text-foreground">{data.os || "Unknown"}</div>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">Location</h4>
                                        <div className="text-sm flex items-center gap-1.5 text-foreground">
                                            {data.country_code ? <img src={`https://flagcdn.com/16x12/${data.country_code.toLowerCase()}.png`} alt="Flag" className="inline opacity-90 h-3" /> : null}
                                            {data.city ? `${data.city}, ` : ''}{data.country_name || "Unknown"}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">Last Shodan Scan</h4>
                                    <div className="text-sm font-mono text-muted-foreground">{new Date(data.last_update).toLocaleDateString() || "Unknown"}</div>
                                </div>
                            </div>
                        </div>

                        {/* Open Ports & CVEs */}
                        <div className="space-y-4 bg-muted bg-opacity-50 p-4 rounded-lg border border-border">
                            <div>
                                <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-2 flex items-center justify-between">
                                    <span>Open Ports ({data.ports?.length || 0})</span>
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {data.ports?.map((p: any) => (
                                        <Badge key={p} variant="secondary" className="font-mono bg-background">
                                            {p}
                                        </Badge>
                                    ))}
                                    {(!data.ports || data.ports.length === 0) && <span className="text-xs text-muted-foreground italic">No open ports mapped by Shodan</span>}
                                </div>
                            </div>

                            <hr className="border-border" />

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-[10px] font-bold tracking-wider text-red-500 uppercase flex items-center gap-1">
                                        <ShieldAlert className="h-3 w-3" />
                                        Known Vulnerabilities ({data.vulns ? (Array.isArray(data.vulns) ? data.vulns.length : Object.keys(data.vulns).length) : 0})
                                    </h4>
                                    {data.vulns && (Array.isArray(data.vulns) ? data.vulns.length : Object.keys(data.vulns).length) > 0 && (
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={launchNucleiScan} disabled={launching} className="h-6 text-[10px] px-2 py-0 border-emerald-500/30 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 transition-colors shadow-sm">
                                                {launching ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Crosshair className="h-3 w-3 mr-1" />}
                                                Verify Exploit
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={copyNucleiCommand} className="h-6 text-[10px] px-2 py-0 border-dashed border-red-500/30 text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors hidden xl:flex">
                                                <Terminal className="h-3 w-3 mr-1" /> Copy Cmd
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                {data.vulns && (Array.isArray(data.vulns) ? data.vulns.length : Object.keys(data.vulns).length) > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                                        {(Array.isArray(data.vulns) ? data.vulns : Object.keys(data.vulns)).map((cve: string) => (
                                            <a key={cve} href={`https://nvd.nist.gov/vuln/detail/${cve}`} target="_blank" rel="noopener">
                                                <Badge variant="destructive" className="cursor-pointer text-[10px] font-mono hover:bg-red-600 transition-colors">
                                                    {cve}
                                                </Badge>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-md font-medium text-center">
                                        No known unpatched CVEs detected on Shodan.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CDN Bypass Banner (Suggestion 2) */}
                        {isCDN && (
                            <div className="md:col-span-2 mt-2 bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg flex flex-col items-start gap-4">
                                <div className="flex items-start gap-3 w-full">
                                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-500">CDN / WAF Detected</h4>
                                            <Button onClick={unmaskOrigin} disabled={unmasking} size="sm" className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                                                {unmasking ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
                                                Unmask Origin IP
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            This IP resolves to a CDN Edge Node ({data.org}), shielding the true origin server. Nuclei scans against this IP will likely be blocked.
                                            Unmask Origin IP will cross-reference Shodan for matching Favicon hashes or SSL signatures bypassing Cloudflare.
                                        </p>
                                    </div>
                                </div>
                                {unmaskedData.length > 0 && (
                                    <div className="w-full bg-black/10 dark:bg-black/40 rounded-md p-3 border border-amber-500/20">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-[10px] font-bold tracking-wider text-amber-500 uppercase">Potential Origin Servers</h5>
                                            <Button variant="outline" size="sm" onClick={copyUnmaskedIps} className="h-5 text-[10px] px-2 py-0 border-dashed border-amber-500/30 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 transition-colors">
                                                <Copy className="h-3 w-3 mr-1" /> Copy All
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {unmaskedData.map((match: any, i: number) => (
                                                <Badge key={i} variant="outline" className="font-mono bg-background border-amber-500/40 text-amber-600 dark:text-amber-400">
                                                    {match.ip_str}
                                                    {match.org && <span className="opacity-60 ml-1">({match.org})</span>}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
