# PROJECT JAMSA

A self-hosted, web-based music streaming application consisting of a JavaScript frontend, Node.js backend, and MongoDB database. Designed to be deployed using Docker and Kubernetes.

## REQUIREMENTS

- **Node.js and npm** – Backend dependencies and development.
- **Docker** – Building and packaging application images.
- **Kubernetes / MicroK8s** – Hosting the frontend, backend, and MongoDB.
- **MongoDB** – Storing music metadata and application data.
- **OpenMediaVault or another FTP server** – Hosting the actual music files.
- **A container registry** – Storing and distributing Docker images.

## PROJECT STRUCTURE

```text
jamsa/
├── backend/
│   ├── api.js
│   ├── package.json
│   ├── package-lock.json
│   └── Dockerfile
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── api.js
│   ├── nginx.conf
│   └── Dockerfile
│
├── kubernetes/
│   ├── backend.yaml
│   ├── frontend.yaml
│   └── mongodb.yaml
│
├── scripts/
│   ├── build-and-push.ps1
│   └── restart.sh
│
├── .gitignore
└── README.md
```

## MUSIC LIBRARY SETUP

Music files should be organized into directories on your FTP server.

The directory name is used as the song's name on the website. Individual music filenames are only used internally.

**Example:**

```text
musicapp/
├── Black Wrist Bro's/
│   └── Black Wrist Bro's (feat. 1st Born).mp3
│
└── i/
    └── Kendrick Lamar-i.mp3
```

Alternatively, files can be named identically inside their respective directories:

```text
musicapp/
├── MUSICNAME/
│   └── music.mp3
│
└── ANOTHERSONG/
    └── music.mp3
```

Make sure the FTP server is accessible from the Kubernetes backend.

## BACKEND SETUP

Navigate to the backend directory:

```bash
cd ./backend
npm ci
```

### Environment Variables

Configure the required environment variables before starting or deploying the backend.

Create a `.env` file in the backend directory:

```env

BACKENDPORT=6777
DB_USER=Username
DB_PASSWORD=Password
DB_HOST=mongodb://mongodb.mongodb.svc.cluster.local/
MUSIC_DB_PORT=21
MUSIC_DB_USER=Username2
MUSIC_DB_PASSWORD=Password2
MUSIC_DB_HOST=IP
```

Replace the example values with your actual configuration.

## MongoDB Setup

JAMSA uses MongoDB to store application metadata. The MongoDB instance is deployed inside Kubernetes in its own `mongodb` namespace.

### Configuration

- **Image:** `mongo:8.2`
- **Namespace:** `mongodb`
- **Deployment:** `mongodb`
- **Service:** `mongodb`
- **Port:** `27017`
- **Storage:** 10Gi persistent volume using `microk8s-hostpath`
- **Database:** `metadatadb`

### Create the namespace

```bash
microk8s kubectl create namespace mongodb
```

### Create the MongoDB credentials

Create a Kubernetes Secret containing the MongoDB root username and password:

```bash
microk8s kubectl create secret generic mongodb-auth \
  --from-literal=username=YOUR_USERNAME \
  --from-literal=password=YOUR_PASSWORD \
  -n mongodb
```

Replace the placeholders with your own credentials. Never commit these credentials to GitHub.

### Deploy MongoDB

Apply the MongoDB manifest:

```bash
microk8s kubectl apply -f kubernetes/mongodb.yaml
```

This creates the persistent volume claim, Deployment, and internal ClusterIP Service.

**Important:** The MongoDB PVC stores database files persistently. Do not delete the PVC when updating or redeploying MongoDB.

### Kubernetes Secrets

Create the Kubernetes Secret using your `.env` file:

```bash
microk8s kubectl create secret generic backend-env \
    --from-env-file=backend/.env \
    -n jamsa \
    --dry-run=client -o yaml | microk8s kubectl apply -f -
```

This allows the backend to access its environment variables without including credentials in the Docker image.

## FRONTEND SETUP

The frontend is served using Nginx.

Nginx also acts as a reverse proxy, forwarding `/api/` requests to the backend Service inside Kubernetes.

This allows the frontend to communicate with the backend without exposing the backend directly to the browser.

Make sure the backend address and port in `nginx.conf` match the Kubernetes Service:

```nginx
location /api/ {
    proxy_pass http://backend.jamsa.svc.cluster.local:6777;
}
```

## CONFIGURATION

Before deploying, check the following configuration files:

| File | Configuration |
|---|---|
| `backend.yaml` | Backend image, ports, and environment Secret |
| `frontend.yaml` | Frontend image and externally accessible port |
| `mongodb.yaml` | MongoDB image, storage, and Service |
| `nginx.conf` | Backend Service address and port |
| `build-and-push.ps1` | Container registry IP address |

### Ports

Default configuration:

| Service | Port | Purpose |
|---|---:|---|
| Backend | 6777 | Express API |
| Frontend | 80 | Nginx HTTP |
| Frontend NodePort | 30080 | External website access |
| MongoDB | 27017 | Database |

The frontend's internal Nginx port should remain 80 unless you also change its container and Service configuration.

The NodePort must be between 30000 and 32767.

## DEPLOYMENT

The following instructions assume you have a working Kubernetes cluster and a private Docker registry.

### 1. Build and Push Docker Images

Update the registry IP address in `build-and-push.ps1` to match your Kubernetes registry.

From the repository root, run:

```powershell
.\scripts\build-and-push.ps1
```

Alternatively, build and push the images manually:

**Frontend:**

```powershell
cd ./frontend
docker build -t IP:32000/jamsa-frontend:1.0 .
docker push IP:32000/jamsa-frontend:1.0
```

**Backend:**

```powershell
cd ../backend
docker build -t IP:32000/jamsa-backend:1.0 .
docker push IP:32000/jamsa-backend:1.0
```

Replace `IP` with the address of your container registry.

### 2. Create Kubernetes Namespace

```bash
microk8s kubectl create namespace jamsa
```

### 3. Create Backend Secrets

From the repository root:

```bash
microk8s kubectl create secret generic backend-env \
    --from-env-file=backend/.env \
    -n jamsa \
    --dry-run=client -o yaml | microk8s kubectl apply -f -
```

### 4. Deploy Kubernetes Resources

Apply the Kubernetes manifests:

```bash
microk8s kubectl apply -f kubernetes/
```

Make sure MongoDB is running before expecting the backend to work correctly.

## UPDATING

After making changes to the frontend or backend, rebuild and push the Docker images.

```powershell
.\scripts\build-and-push.ps1
```

Then restart the deployments from a Kubernetes host:

```bash
./scripts/restart.sh
```

The restart script restarts both the frontend and backend deployments and waits for them to become ready.

**Note:** When reusing image tags such as `1.0`, set `imagePullPolicy: Always` in the Kubernetes deployment manifests to ensure updated images are pulled.

Alternatively, use a new image tag for every release.


## SECURITY

- Never expose MongoDB or FTP credentials to the frontend.
- Never commit `.env` files or Kubernetes Secrets containing real credentials.
- Keep MongoDB accessible only to services that require it.
- Use HTTPS when exposing the application publicly.
- Restrict access to the container registry and administrative interfaces.

---

**PROJECT JAMSA**