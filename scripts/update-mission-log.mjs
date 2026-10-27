import fs from "node:fs";

const username = process.env.GITHUB_USERNAME;
const token = process.env.GITHUB_TOKEN;
const readmePath = "README.md";
const startMarker = "<!-- RECENT_REPOS_START -->";
const endMarker = "<!-- RECENT_REPOS_END -->";

if (!username || !token) {
  throw new Error("GITHUB_USERNAME and GITHUB_TOKEN must be set.");
}

async function main() {
  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&direction=desc&per_page=100&type=owner`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mission-control-profile-readme"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }

  const repos = await response.json();
  const selected = repos
    .filter((repo) => !repo.fork && !repo.archived && !repo.private)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);

  const section = selected.length
    ? [
        "_Latest updated public repositories (automatically refreshed weekly):_",
        "",
        ...selected.map((repo) => {
          const description = repo.description
            ? ` — ${repo.description.replace(/\r?\n/g, " ").trim()}`
            : "";
          const language = repo.language ? ` · \`${repo.language}\`` : "";
          const updated = new Date(repo.updated_at).toISOString().slice(0, 10);
          return `- [**${repo.name}**](${repo.html_url})${description}${language} · updated ${updated}`;
        })
      ].join("\n")
    : "_No eligible public repositories were found for this account yet._";

  const readme = fs.readFileSync(readmePath, "utf8");
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Could not find the mission log markers in README.md.");
  }

  const before = readme.slice(0, start + startMarker.length);
  const after = readme.slice(end);
  const updatedReadme = `${before}\n${section}\n${after}`;

  if (updatedReadme !== readme) {
    fs.writeFileSync(readmePath, updatedReadme, "utf8");
    console.log(`Updated mission log with ${selected.length} repository/repositories.`);
  } else {
    console.log("Mission log already matches the latest repository data.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
