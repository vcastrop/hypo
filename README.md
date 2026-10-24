# hypo
Hypo is a guided Chaos Engineering platform for resilience validation in Kubernetes-based SMEs.

It helps small and medium-sized companies running microservices on Kubernetes discover resilience vulnerabilities, run controlled failure experiments, measure the impact, and get actionable, business-readable recommendations — without needing a dedicated SRE team or access to a client's internal network.

## Quickstart

### Frontend (Hypo Platform Web)
```bash
cd frontend
npm install
npm run dev   # or npm.cmd run dev on Windows
```
Runs at `http://localhost:3000`. Full guide in [frontend/README.md](frontend/README.md).

### Backend (FastAPI API)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```
Runs at `http://localhost:8000`. Full guide in [backend/README.md](backend/README.md).

## Contributing

See CONTRIBUTING.md for branching strategy, commit conventions, and how to pick up an issue.