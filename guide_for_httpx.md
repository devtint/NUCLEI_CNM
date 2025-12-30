# HTTPX Guide

A comprehensive guide on running and using HTTPX, including valid flags, usage examples, and troubleshooting tips.

## 🚀 Running HTTPX

Learn about running httpx with examples including commands and output.

### Basic Examples

#### ASN Fingerprint

Use httpx with the `-asn` flag for ASN (Autonomous System Number) fingerprinting, an effective technique for mapping the network affiliations of various domains.

```bash
subfinder -d hackerone.com -silent | httpx -asn
```

**Output:**
```
https://mta-sts.managed.hackerone.com [AS54113, FASTLY, US]
https://gslink.hackerone.com [AS16509, AMAZON-02, US]
https://www.hackerone.com [AS13335, CLOUDFLARENET, US]
...
```

#### ASN Input

Specify an autonomous system’s number (ASN) and httpx will fetch all ip addresses of that autonomous system and probe them.

```bash
echo AS14421 | httpx -silent
```

**Output:**
```
https://216.101.17.248
https://216.101.17.249
...
```

#### CIDR Input

Run httpx with CIDR input (for example `173.0.84.0/24`).

```bash
echo 173.0.84.0/24 | httpx -silent
```

#### Docker Run

Use Docker to run httpx in an isolated container.

```bash
cat sub_domains.txt | docker run -i projectdiscovery/httpx
```

#### Error Page Classifier and Filtering

Use `-fep` to classify and filter out common error pages.

```bash
httpx -l urls.txt -path /v1/api -fep
```

#### Favicon Hash

Extract and display the mmh3 hash of the `/favicon.ico` file.

```bash
subfinder -d hackerone.com -silent | httpx -favicon
```

**Output:**
```
https://docs.hackerone.com/favicon.ico [595148549]
...
```

#### File/Path Bruteforce

Use `-path` for specific paths across multiple URLs.

```bash
httpx -l urls.txt -path /v1/api -sc
```

#### File Input

Run httpx with `-probe` flag against hosts in a file.

```bash
httpx -list hosts.txt -silent -probe
```

#### JARM Fingerprint

Use `-jarm` for active TLS server fingerprinting.

```bash
subfinder -d hackerone.com -silent | httpx -jarm
```

#### Tool Chain

Pipe results from subfinder directly into `httpx`.

```bash
subfinder -d hackerone.com -silent| httpx -title -tech-detect -status-code
```

#### URL Probe

Run httpx against all hosts in a file to return URLs running an HTTP webserver.

```bash
cat hosts.txt | httpx
```

---

## 🖥️ UI Dashboard (PDCP Integration)

### Configure API Key

1.  Obtain API Key from [ProjectDiscovery Cloud](https://cloud.projectdiscovery.io).
2.  Use `httpx -auth` and enter your API key.

### Run httpx with UI Dashboard

Upload results to the ProjectDiscovery Cloud Platform (PDCP) UI Dashboard.

```bash
chaos -d hackerone.com | httpx -dashboard
```

**Additional Options:**
*   `-dashbaord`, `-pd`: Enable uploading.
*   `-aid`, `-asset-id string`: Upload to existing asset ID.
*   `-aname`, `-asset-name string`: Set asset group name.

---

## 📸 Usage & Usage Flags

### Input Flags
*   `-l`, `-list string`: Input file containing list of hosts to process.
*   `-u`, `-target string[]`: Input target host(s) to probe.

### Probes
*   `-sc`, `-status-code`: Display response status-code.
*   `-cl`, `-content-length`: Display response content-length.
*   `-tech-detect`, `-td`: Display technology in use.
*   `-title`: Display page title.
*   `-bp`, `-body-preview`: Display first N characters of response body.

### Headless (Screenshots)
*   `-ss`, `-screenshot`: Enable saving screenshot using headless browser.
*   `-system-chrome`: Use local installed Chrome.

### Matchers & Filters
*   `-mc`, `-match-code string`: Match response with specified status code (e.g., `-mc 200,302`).
*   `-ms`, `-match-string string`: Match response with specified string.
*   `-fc`, `-filter-code string`: Filter response with specified status code.

### Rate Limit
*   `-t`, `-threads int`: Number of threads (default 50).
*   `-rl`, `-rate-limit int`: Maximum requests per second (default 150).

### Miscellaneous
*   `-p`, `-ports string[]`: Ports to probe (e.g., `http:80,https:443`).
*   `-path string`: Path or list of paths to probe.
*   `-http2`: Probe and display HTTP2 support.
*   `-follow-redirects`, `-fr`: Follow HTTP redirects.

### Output
*   `-o`, `-output string`: File to write output results.
*   `-j`, `-json`: Store output in JSONL format.
*   `-csv`: Store output in CSV format.

---

## 📝 Notes

*   By default, httpx falls back to HTTP only if HTTPS is not reachable. Use `-no-fallback` to probe both.
*   Custom schemes for ports can be defined (e.g., `-ports http:443`).
*   Screenshots use a headless browser and may be slower.
