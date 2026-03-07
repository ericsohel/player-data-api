const { useEffect, useMemo, useRef, useState } = React;

const DEFAULT_FORM = {
  search: "",
  team: "",
  position: "",
  sortBy: "fpts",
  sortOrder: "desc",
  limit: "25",
  offset: "0",
  minFpts: "",
  maxFpts: "",
  minHr: "",
  maxHr: "",
  minRbi: "",
  maxRbi: "",
  minAvg: "",
  maxAvg: "",
};

const QUERY_FIELDS = [
  "search",
  "team",
  "position",
  "sortBy",
  "sortOrder",
  "limit",
  "offset",
  "minFpts",
  "maxFpts",
  "minHr",
  "maxHr",
  "minRbi",
  "maxRbi",
  "minAvg",
  "maxAvg",
];

function request(path, { method = "GET", apiKey = "", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;

  return fetch(path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || response.statusText || "Request failed");
    error.data = data;
    throw error;
  }
  return data;
}

function JsonOutput({ value, isError }) {
  if (!value) return null;
  return (
    <pre className={`out ${isError ? "error" : "success"}`} aria-live="polite">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function buildFilterSummary(filters) {
  if (!filters) return "none";
  const parts = [];
  if (filters.search) parts.push(`search=${filters.search}`);
  if (Array.isArray(filters.teams) && filters.teams.length) {
    parts.push(`team=${filters.teams.join(",")}`);
  }
  if (Array.isArray(filters.positions) && filters.positions.length) {
    parts.push(`position=${filters.positions.join(",")}`);
  }
  if (filters.ranges && typeof filters.ranges === "object") {
    Object.entries(filters.ranges).forEach(([field, range]) => {
      parts.push(`${field}:[${range.min ?? "-"}..${range.max ?? "-"}]`);
    });
  }
  return parts.length ? parts.join(" | ") : "none";
}

function App() {
  const [apiKey, setApiKey] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [filterOptions, setFilterOptions] = useState({ teams: [], positions: [], sortFields: [] });
  const [filterStatus, setFilterStatus] = useState("Enter your API key and load filters.");
  const [licenseOutput, setLicenseOutput] = useState({ value: null, isError: false });
  const [pushOutput, setPushOutput] = useState({ value: null, isError: false });
  const [pullOutput, setPullOutput] = useState({ value: null, isError: false });
  const [playersResult, setPlayersResult] = useState(null);
  const filterRequestIdRef = useRef(0);

  const sortFields = useMemo(() => {
    if (!filterOptions.sortFields?.length) {
      return ["fpts", "playerName", "team", "position", "hr", "rbi", "avg", "sb", "obp", "slg"];
    }
    return filterOptions.sortFields;
  }, [filterOptions.sortFields]);

  async function loadFilters() {
    const key = apiKey.trim();
    if (!key) {
      setFilterOptions({ teams: [], positions: [], sortFields: [] });
      setFilterStatus("Enter your API key and load filters.");
      return;
    }

    const requestId = filterRequestIdRef.current + 1;
    filterRequestIdRef.current = requestId;
    setFilterStatus("Loading filters...");

    try {
      const data = await readJson(await request("/players/filters", { apiKey: key }));
      if (requestId !== filterRequestIdRef.current) return;
      const filters = data.filters || {};
      setFilterOptions({
        teams: filters.teams || [],
        positions: filters.positions || [],
        sortFields: filters.sortFields || [],
      });
      setFilterStatus(
        `Loaded ${filters.teams?.length || 0} teams and ${filters.positions?.length || 0} positions.`
      );
    } catch (error) {
      if (requestId !== filterRequestIdRef.current) return;
      setFilterOptions({ teams: [], positions: [], sortFields: [] });
      setFilterStatus(error.message);
    }
  }

  useEffect(() => {
    if (!apiKey.trim()) {
      setFilterOptions({ teams: [], positions: [], sortFields: [] });
      setFilterStatus("Enter your API key and load filters.");
      return;
    }
    loadFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function resetFilters() {
    setForm(DEFAULT_FORM);
    setPlayersResult(null);
    setPullOutput({ value: null, isError: false });
  }

  async function handleCheckLicense() {
    try {
      const data = await readJson(await request("/license/check", { apiKey: apiKey.trim() }));
      setLicenseOutput({ value: data, isError: false });
    } catch (error) {
      setLicenseOutput({ value: error.data || { error: error.message }, isError: true });
    }
  }

  async function handlePushUsage() {
    try {
      const data = await readJson(
        await request("/usage", {
          method: "POST",
          apiKey: apiKey.trim(),
          body: {
            event: "draft_view",
            timestamp: new Date().toISOString(),
            metadata: { source: "demo" },
          },
        })
      );
      setPushOutput({ value: data, isError: false });
    } catch (error) {
      setPushOutput({ value: error.data || { error: error.message }, isError: true });
    }
  }

  async function handleSearchPlayers() {
    const params = new URLSearchParams();
    QUERY_FIELDS.forEach((field) => {
      const value = String(form[field] || "").trim();
      if (value) params.set(field, value);
    });

    try {
      const queryString = params.toString();
      const data = await readJson(
        await request(`/players${queryString ? `?${queryString}` : ""}`, { apiKey: apiKey.trim() })
      );
      setPullOutput({ value: null, isError: false });
      setPlayersResult({ ...data, queryString });
    } catch (error) {
      setPlayersResult(null);
      setPullOutput({ value: error.data || { error: error.message }, isError: true });
    }
  }

  return (
    <main className="page">
      <header className="header">
        <h1>Player Data API Demo</h1>
        <p>
          Single-port frontend on <code>http://localhost:4001</code>.
        </p>
      </header>

      <section className="card">
        <h2>API Key</h2>
        <div className="row key-row">
          <input
            type="text"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="your-secret-key"
            autoComplete="off"
          />
          <button type="button" className="secondary" onClick={loadFilters}>
            Load Filters
          </button>
        </div>
        <p className="status">{filterStatus}</p>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>1) License Check</h2>
          <button type="button" onClick={handleCheckLicense}>
            Check License
          </button>
          <JsonOutput value={licenseOutput.value} isError={licenseOutput.isError} />
        </article>

        <article className="card">
          <h2>3) Push Usage</h2>
          <button type="button" onClick={handlePushUsage}>
            Push Usage
          </button>
          <JsonOutput value={pushOutput.value} isError={pushOutput.isError} />
        </article>
      </section>

      <section className="card">
        <h2>2) Pull Players</h2>

        <div className="grid fields">
          <label>
            Search
            <input name="search" value={form.search} onChange={updateField} placeholder="e.g. soto" />
          </label>
          <label>
            Team
            <select name="team" value={form.team} onChange={updateField}>
              <option value="">Any team</option>
              {filterOptions.teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <label>
            Position
            <select name="position" value={form.position} onChange={updateField}>
              <option value="">Any position</option>
              {filterOptions.positions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select name="sortBy" value={form.sortBy} onChange={updateField}>
              {sortFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort order
            <select name="sortOrder" value={form.sortOrder} onChange={updateField}>
              <option value="desc">desc</option>
              <option value="asc">asc</option>
            </select>
          </label>
          <label>
            Limit
            <input name="limit" type="number" min="1" max="200" value={form.limit} onChange={updateField} />
          </label>
          <label>
            Offset
            <input name="offset" type="number" min="0" value={form.offset} onChange={updateField} />
          </label>
          <label>
            Min fpts
            <input name="minFpts" type="number" value={form.minFpts} onChange={updateField} />
          </label>
          <label>
            Max fpts
            <input name="maxFpts" type="number" value={form.maxFpts} onChange={updateField} />
          </label>
          <label>
            Min hr
            <input name="minHr" type="number" value={form.minHr} onChange={updateField} />
          </label>
          <label>
            Max hr
            <input name="maxHr" type="number" value={form.maxHr} onChange={updateField} />
          </label>
          <label>
            Min rbi
            <input name="minRbi" type="number" value={form.minRbi} onChange={updateField} />
          </label>
          <label>
            Max rbi
            <input name="maxRbi" type="number" value={form.maxRbi} onChange={updateField} />
          </label>
          <label>
            Min avg
            <input name="minAvg" type="number" step="0.001" value={form.minAvg} onChange={updateField} />
          </label>
          <label>
            Max avg
            <input name="maxAvg" type="number" step="0.001" value={form.maxAvg} onChange={updateField} />
          </label>
        </div>

        <div className="row">
          <button type="button" onClick={handleSearchPlayers}>
            Search Players
          </button>
          <button type="button" className="secondary" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <JsonOutput value={pullOutput.value} isError={pullOutput.isError} />

        {playersResult ? (
          <section className="summary">
            <p>
              Query: <code>{playersResult.queryString || "none"}</code>
            </p>
            <p>
              Showing {playersResult.players?.length || 0} of {playersResult.total || 0} | sort=
              {playersResult.sort?.by}:{playersResult.sort?.order}
            </p>
            <p>Filters: {buildFilterSummary(playersResult.filters)}</p>

            {playersResult.players?.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>id</th>
                      <th>playerName</th>
                      <th>team</th>
                      <th>position</th>
                      <th>hr</th>
                      <th>rbi</th>
                      <th>avg</th>
                      <th>fpts</th>
                      <th>sb</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playersResult.players.map((player) => (
                      <tr key={player.id}>
                        <td>{player.id}</td>
                        <td>{player.playerName}</td>
                        <td>{player.team}</td>
                        <td>{player.position}</td>
                        <td>{player.hr}</td>
                        <td>{player.rbi}</td>
                        <td>{player.avg}</td>
                        <td>{player.fpts}</td>
                        <td>{player.sb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No players matched this query.</p>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
