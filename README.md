# Parking Operational Intelligence Platform (POIP)

The **Parking Operational Intelligence Platform (POIP)** is a spatial intelligence and decision-support framework built for urban traffic enforcement. It transforms large-scale parking violation logs (298,450 records from Bengaluru) into a prioritized enforcement queue and dynamic zone governance strategies.

Designed for traffic police departments, smart-city planners, and GIS operators, POIP moves away from simple, misleading "violation count" heatmaps. Instead, it computes multidimensional obstruction indices, models congestion spillover across the road network, predicts future hotspot severities, and discovers spatial-behavioral archetypes to recommend targeted interventions.

---

## ⚡ Production-Grade Microservice Architecture (Dual-Backend)

To prevent RAM out-of-memory (OOM) errors and optimize hosting costs on free-tier services (which limit RAM to 512MB), POIP splits the backend load into two parallel web services managed by a single frontend:

1. **Primary Dashboard Backend**:
   - Handles KPIs, maps, forecast data, and network intelligence metrics.
   - Run via `requirements.txt` (extremely lightweight, loads in seconds, uses under 100MB of RAM).
2. **Semantic Search Backend**:
   - Handles natural-language queries by searching the vector index database.
   - Run via `requirements-semantic.txt` (includes FAISS index only — no `sentence-transformers` needed).
3. **Hugging Face Inference API Embedding Offloading**:
   - Instead of loading the heavy `sentence-transformers` model locally (~1.2–1.5 GB RAM, causes OOM on free tier), the semantic backend makes a lightweight HTTP POST to the **Hugging Face Inference API** (`sentence-transformers/all-MiniLM-L6-v2`) using a `HF_TOKEN` environment variable.
   - The returned 384-dim vector is matched against the local FAISS index in milliseconds — keeping the pipeline fully vector-based while using **< 150 MB RAM**.
   - If the HF API is unavailable or the token is missing, the service automatically falls back to fast **keyword-based text matching** on the same index, so search always returns results.
4. **Vercel Reverse Proxy Routing**:
   - Vercel routes `/api/search` queries to the **Semantic Search Backend**, `/api/*` to the **Primary Backend**, and `/health/*` paths for centralized UptimeRobot monitoring.

---

## 🏗️ Workflow Architecture

POIP operates as a sequential analytics pipeline. High-volume, raw logs are processed through spatial, statistical, machine learning, and network layers, producing lightweight data artifacts that power a real-time interactive dashboard.

```
                          [ RAW VIOLATION DATA (CSV) ]
                                       │
                                       ▼
                         [ Cleaning & Temporal Encoding ]
                                       │
                                       ▼
                         [ Spatial Discretisation (H3) ]
                                       │
                                       ▼
                          [ Row-Level POI Calculation ]
                                       │
                                       ▼
                        ┌──────────────┴──────────────┐
                        ▼                             ▼
              [ HDBSCAN Clustering ]        [ Cell aggregation ]
                        │                             │
                        └──────────────┬──────────────┘
                                       │
                                       ▼
                         [ Propagation & Network Spill ]
                                       │
                                       ▼
                         [ Enforcement Failure Index ]
                                       │
                                       ▼
                          [ Congestion Impact Score ]
                                       │
                                       ▼
                           [ Hotspot Lifecycle State ]
                                       │
                                       ▼
                          [ Behavior Archetype KMeans ]
                                       │
                                       ▼
                           [ CatBoost Forecasting ]
                                       │
                                       ▼
                         [ Priority Engine (FPS Score) ]
                                       │
                                       ▼
                       [ Exported JSON/CSV Data Artifacts ]
                                       │
                                       ▼
                         [ React UI & Interactive Maps ]
```

### Key Stages

1. **Spatial Discretisation & Cleaning**: Filters invalid GPS points and divides Bengaluru into H3 resolution-9 hexagonal cells ($\approx 174\text{m}$ edge length).
2. **Parking Obstruction Index (POI)**: A multiplicative severity score calculated per violation. It integrates vehicle footprint (e.g., bus vs. scooter), violation severity (e.g., double parking vs. no-parking zone), junction proximity, and local density.
3. **HDBSCAN Clustering**: Discovers organic, density-variable hotspot clusters across coordinates without administrative boundary assumptions.
4. **Propagation Modelling**: Simulates network spillover to neighboring cells using an inverse-distance weighted nearest-neighbor algorithm.
5. **Enforcement Failure Index (EFI)**: Measures the persistence of chronic violations in the face of local police precinct capacity constraints (burdened stations).
6. **Congestion Impact Score (CIS)**: Aggregates cell-level impact into Low, Medium, High, and Critical operational bands.
7. **Behavioral Archetypes (KMeans)**: Identifies 6 distinct behavioral profiles (e.g., *Junction Choke Points*, *Freight Obstruction Corridors*, *Night Spillovers*) to apply specialized policies.
8. **CatBoost Forecasting**: Regressor predicting the next-hour severity (POI sum) and Classifier predicting high-risk events.
9. **Priority Engine**: Combines all scores into a single **Final Priority Score (FPS)** to establish the daily ranked enforcement queue.

---

## 🕸️ Network Intelligence Layer (Pseudo-GNN)

The **Network Intelligence** module models the city's hotspot ecosystem as a similarity-weighted undirected graph containing 300 key nodes (representing the top spatial cells/hotspots). It employs a **pseudo-GNN (Graph Neural Network) neighborhood aggregation pattern** to represent and target systemic congestion.

### How it works:
1. **Node Definition**: Each node represents a distinct H3 spatial cell hotspot (e.g., Rajajinagar entrance, Anand Rao junction).
2. **Edge Construction (7D Feature Similarity)**: Edges are not drawn purely by geographical adjacency, but by behavioral similarity in a 7-dimensional feature space:
   $$X = \{\mu_{\text{POI}}, \text{CIS}, \text{Propagation Score}, \text{EFI}, \text{Heavy Vehicle Ratio}, \text{Junction Ratio}, \text{Violation Volume}\}$$
   Edges connect cells that are mutually within each other's 5 nearest neighbors in this feature space, with edge weights defined as $W_{ij} = 1 - d_{\text{cosine}}$ (cosine similarity).
3. **Pseudo-GNN Message Passing**:
   - The graph performs **spatial propagation aggregation**: each node's local congestion impact is updated by aggregating severity messages from its topological and geographical neighbors (using the inverse-distance weighted nearest-neighbor spillover).
   - This mimics the message passing layers of a Graph Neural Network (GNN), where a node's final state combines its own features with aggregated neighbor features.
4. **Structural Analysis**:
   - **PageRank Centrality**: Identifies "hub" hotspots that are connected to other highly severe, similar zones. Targeting these hubs yields cascading compliance benefits.
   - **Betweenness Centrality**: Flags "gateway" hotspots that bridge different behavioral clusters. Enforcing these nodes fragments the city's congestion graph.
   - **Community Detection**: Partitions the graph into behavioral communities (e.g., residential overflow clusters vs. industrial corridors) using the Clauset-Newman-Moore modularity maximization algorithm.

### Example Scenario:
Consider **BTP023 - Mahalaxmi Layout Entrance** (Node A) and **BTP083 - AS Char Street** (Node B). 
- Both nodes are highly active junctions showing severe loading behaviors.
- The system draws an edge between Node A and Node B because they share high similarity in their junction ratio, mean POI, and EFI (Enforcement Failure Index).
- Through the **pseudo-GNN neighborhood aggregation**, the propagation score of Node A is updated by receiving neighbor congestion metrics from Node B.
- When an enforcement officer targets Node A (Mahalaxmi Layout), the compliance behavior propagates to Node B, allowing smart-city teams to dispatch resources to structural "hubs" rather than chasing isolated incidents.

---

## 📂 Directory Structure

```
Parking_Operational_Intelligence/
├── backend/                              # FastAPI Python Backend
│   ├── api/
│   │   ├── __init__.py
│   │   └── endpoints.py                  # API endpoints serving KPIs, maps, & forecasts
│   ├── services/
│   │   ├── __init__.py
│   │   └── data_service.py               # Aggregates datasets, models propagation, handles logic
│   ├── Artifacts/                        # Precomputed data exports (CSVs, GeoJSON, HTML)
│   ├── main.py                           # App entry point with CORS & router attachment
│   ├── requirements.txt                  # Primary backend deps (no ML libs, ultra-lightweight)
│   └── requirements-semantic.txt         # Semantic backend deps (faiss-cpu + requests for HF API)
│
├── frontend/                             # React + TS + Vite + Tailwind Frontend
│   ├── public/                           # Static assets
│   ├── src/
│   │   ├── assets/
│   │   ├── components/                   # Shared UI components (e.g., ClusteredLayer map helper)
│   │   ├── pages/                        # Individual dashboard modules:
│   │   │   │   ├── ExecutiveCommandCenter.tsx # Main high-level metrics, charts, & priority queue
│   │   │   ├── GISOperationsMap.tsx      # Map interface with cluster visualization
│   │   │   ├── HotspotExplorer.tsx       # Tabular data grid with filters
│   │   │   ├── ForecastCenter.tsx        # CatBoost predictions vs. actual hourly trends
│   │   │   ├── ArchetypeIntelligence.tsx # KMeans cluster profiles and custom interventions
│   │   │   ├── NetworkIntelligence.tsx   # PageRank centralities & community network graph
│   │   │   ├── DynamicPolicyEngine.tsx   # Policy simulation & zone governance dashboard
│   │   │   └── SemanticSearch.tsx        # AI-powered natural language hotspot search (semantic backend)
│   │   ├── App.tsx                       # React routing structure
│   │   ├── Layout.tsx                    # Sidebar layout & navigation
│   │   └── index.css                     # Global styles
│   ├── package.json                      # npm packages
│   └── vite.config.ts                    # Vite config
│
├── Notebook/                             # Analysis & ML Training
│   └── flipkart-gridlock-r2-theme-1-solution.ipynb  # Primary development notebook
│
├── Report/                               # Documentation
│   ├── Parking_Operational_Intelligence_Report.pdf  # Detailed technical report (PDF)
│   └── Parking_Operational_Intelligence_Report.tex  # LaTeX sources
│
├── test_backend.py                       # Lightweight integration script for backend services
└── README.md                             # This file
```

---

## 🚀 Getting Started

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the development server:
   ```bash
   uvicorn main:app --reload
   ```
   *The API will be available at `http://127.0.0.1:8000`.*

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   *Open `http://localhost:5173` in your browser.*

---

## 🌐 Deployment Instructions (Dual-Backend Microservice Architecture)

To optimize hosting cost and prevent RAM out-of-memory (OOM) errors, this platform is designed as a **split-microservices backend** targeting a single unified React frontend:
1. **Primary Backend**: A lightweight FastAPI instance that serves the KPIs, maps, and forecasts (running `requirements.txt` with NO `faiss` or `sentence-transformers`).
2. **Semantic Search Backend**: A dedicated heavy FastAPI instance running only the vector search capabilities (running `requirements-semantic.txt` which loads `faiss` and the sentence transformer embeddings).

---

### Step 1: Deploy the Primary Backend (FastAPI) to Render
This backend runs the core dashboard APIs:
1. Log in to [render.com](https://render.com/) and create a new **Web Service**. Connect this repository.
2. Configure settings:
   - **Name**: e.g., `parking-primary-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt` (Installs lightweight packages only)
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Deploy the service and **copy the live URL** (e.g., `https://parking-primary-backend.onrender.com`).

---

### Step 2: Deploy the Semantic Search Backend (FastAPI) to Render
This backend handles AI-powered natural-language hotspot queries — it is designed to be **lean by design**:
- Uses **FAISS** for vector similarity search on precomputed embeddings (loaded from `hotspot_embeddings.npy`).
- Does **not** load `sentence-transformers` locally — embedding extraction is offloaded to the **Hugging Face Inference API** via `requests`, keeping RAM under 150 MB.
- Falls back to fast keyword matching if the HF API is unavailable.

1. Log in to [render.com](https://render.com/) and create a *second* **Web Service**. Connect this repository.
2. Configure settings:
   - **Name**: e.g., `parking-semantic-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements-semantic.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free tier (512 MB RAM) is sufficient — no transformer model loaded locally.
3. Add the following **Environment Variable** in the Render dashboard:
   | Key | Value |
   |-----|-------|
   | `HF_TOKEN` | Your Hugging Face API token (get one free at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)) |
4. Deploy the service and **copy the live URL** (e.g., `https://parking-semantic-backend.onrender.com`).

---

### Step 3: Deploy the Frontend (Vite/React) to Vercel
Vercel will act as a reverse proxy, dynamically routing relative frontend paths to the correct backend microservice:
1. Log in to [vercel.com](https://vercel.com/) and import your repository.
2. Configure settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
3. Edit [frontend/vercel.json](file:///a:/hackathon/gridloack%20r2/repo/Parking_Operational_Intelligence/frontend/vercel.json) in your repository and set the `destination` URLs to match your deployed services:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/search",
         "destination": "https://parking-semantic-backend.onrender.com/api/search"
       },
       {
         "source": "/api/:path*",
         "destination": "https://parking-primary-backend.onrender.com/api/:path*"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
4. Deploy the project on Vercel. Now, when the browser makes API requests:
   - Queries to `/api/search` are routed to the **Semantic Search Backend**.
   - All other API queries are routed to the **Primary Backend**.
   - No CORS errors occur, and no frontend environment variables are required!


