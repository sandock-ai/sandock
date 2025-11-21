# Sandock Python Runtime

Lightweight Python Docker image with essential packages pre-installed, designed specifically for Sandock AI code execution environments.

## Features

### Python Version
- **Python 3.11** - Stable, high-performance, and widely supported

### Design Philosophy
A fully-featured Python sandbox environment for AI Agents:
- ✅ **Data Processing** - Core data processing with numpy and pandas
- ✅ **File Handling** - Support for Excel, Word, PDF, and other common formats
- ✅ **HTTP Requests** - HTTP/HTTPS requests and web scraping
- ✅ **Async Operations** - Async HTTP and file I/O support
- ✅ **Configuration** - Environment variables, YAML, JSON
- ❌ **Not Included** - Database drivers, machine learning libraries, visualization libraries

### Pre-installed Packages

#### Core Data Processing (Most Commonly Used)
- **numpy** (1.26.4) - Numerical computing foundation
- **pandas** (2.2.3) - Data analysis and manipulation

#### HTTP & Networking
- **requests** (2.32.3) - Simple and elegant HTTP client
- **httpx** (0.27.2) - Modern async HTTP client
- **beautifulsoup4** (4.12.3) - HTML/XML parsing
- **lxml** (5.3.0) - High-performance XML/HTML parser

#### File Format Handling
- **openpyxl** (3.1.5) - Excel file read/write (.xlsx)
- **python-docx** (1.1.2) - Word document processing
- **PyPDF2** (3.0.1) - PDF file operations
- **pypdf** (5.1.0) - Modern PDF library
- **chardet** (5.2.0) - Character encoding detection

#### Configuration & Data Formats
- **python-dotenv** (1.0.1) - Environment variable management
- **pyyaml** (6.0.2) - YAML configuration file parsing
- **jsonschema** (4.23.0) - JSON data validation

#### Date & Time
- **python-dateutil** (2.9.0) - Date/time utilities
- **pytz** (2024.2) - Timezone handling

#### Image Processing
- **pillow** (10.4.0) - Lightweight image processing

#### Async Operations
- **aiohttp** (3.10.10) - Async HTTP framework
- **aiofiles** (24.1.0) - Async file operations

#### Development Tools
- **ipython** (8.28.0) - Enhanced Python interactive shell

## Build & Publish

### 1. Local Build

```bash
cd /root/vika/kapps/projects/sandock/dockers/sandock-python
docker build -t sandock-python:latest .
```

### 2. Test the Image

```bash
# Test Python version
docker run --rm sandock-python:latest python --version

# Test installed packages
docker run --rm sandock-python:latest pip list

# Interactive testing
docker run -it --rm sandock-python:latest python
```

### 3. Publish to Docker Hub

#### Prerequisites
- Docker Hub account (e.g., `sandockai`)
- Logged in to Docker Hub

```bash
# Login to Docker Hub
docker login

# Option 1: Single platform build and push (fast)
docker build -t sandockai/sandock-python:latest .
docker push sandockai/sandock-python:latest

# Option 2: Multi-platform build and push (recommended, supports AMD64 and ARM64)
docker buildx create --use --name sandock-builder
docker buildx build --platform linux/amd64,linux/arm64 \
  -t sandockai/sandock-python:latest \
  -t sandockai/sandock-python:1.0.0 \
  --push .

# Clean up builder (optional)
docker buildx rm sandock-builder
```

### 4. Publish with Version Tags

```bash
# Push both latest and version tags
docker buildx build --platform linux/amd64,linux/arm64 \
  -t sandockai/sandock-python:latest \
  -t sandockai/sandock-python:1.0.0 \
  -t sandockai/sandock-python:1.0 \
  -t sandockai/sandock-python:1 \
  --push .
```

## Usage

### Basic Usage

#### 1. Run Interactive Python Shell
```bash
docker run -it --rm sandockai/sandock-python:latest python
```

#### 2. Execute Python Script
```bash
# Mount current directory
docker run -it --rm -v $(pwd):/workspace sandockai/sandock-python:latest python script.py
```

#### 3. Run Bash Shell
```bash
docker run -it --rm sandockai/sandock-python:latest bash
```

### Using with Sandock

#### Sandock MCP
```typescript
// Create sandbox with Python image
const { sandboxId } = await sandock_create_sandbox({
  name: "python-analysis",
  image: "sandockai/sandock-python:latest"
});

// Execute Python code
await sandock_run_code({
  sandboxId,
  language: "python",
  code: `
import pandas as pd
import numpy as np

data = {'A': [1, 2, 3], 'B': [4, 5, 6]}
df = pd.DataFrame(data)
print(df.describe())
  `
});
```

#### Sandock CLI
```bash
# Create sandbox
sandock sandbox create --name python-env --image sandockai/sandock-python:latest

# Execute command
sandock sandbox exec <sandbox-id> "python -c 'import pandas; print(pandas.__version__)'"
```

### Usage Examples

#### 1. Data Processing Example
```python
import pandas as pd
import numpy as np

# Read CSV data
df = pd.read_csv('/workspace/data.csv')

# Data analysis
print(df.describe())
print(df.groupby('category')['value'].sum())

# Data processing
df['new_column'] = df['value'] * 2
df_filtered = df[df['value'] > 100]

# Save results
df_filtered.to_csv('/workspace/result.csv', index=False)

# NumPy array operations
arr = np.array([1, 2, 3, 4, 5])
print(f'Mean: {arr.mean()}, Std: {arr.std()}')
```

#### 2. File Handling Example
```python
import pandas as pd
import openpyxl
from docx import Document
import PyPDF2

# Read Excel (using pandas)
df = pd.read_excel('/workspace/data.xlsx')
print(df.head())

# Or use openpyxl directly
wb = openpyxl.load_workbook('/workspace/data.xlsx')
sheet = wb.active
for row in sheet.iter_rows(values_only=True):
    print(row)

# Create Word document
doc = Document()
doc.add_heading('Data Analysis Report', 0)
doc.add_paragraph(f'Total records: {len(df)}')
doc.save('/workspace/report.docx')

# Read PDF
with open('/workspace/document.pdf', 'rb') as file:
    reader = PyPDF2.PdfReader(file)
    text = reader.pages[0].extract_text()
    print(text)
```

#### 3. HTTP Request Example
```python
import requests
from bs4 import BeautifulSoup

# HTTP request
response = requests.get('https://api.example.com/data')
data = response.json()
print(data)

# Web scraping
response = requests.get('https://example.com')
soup = BeautifulSoup(response.text, 'html.parser')
title = soup.find('title').text
print(f'Page title: {title}')
```

#### 4. Async Operations Example
```python
import asyncio
import aiohttp
import aiofiles

async def fetch_data(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.text()

async def save_file(content, path):
    async with aiofiles.open(path, 'w') as f:
        await f.write(content)

# Run async tasks
asyncio.run(fetch_data('https://api.example.com'))
```

## Image Size

- Base image: `python:3.11-slim-bookworm` (~130 MB)
- Final image: ~600-700 MB (includes numpy and pandas)

Includes the most commonly used data processing libraries while maintaining a reasonable image size.

## Updating Package Versions

To update package versions, edit the version numbers in `Dockerfile`, then rebuild:

```bash
# Edit Dockerfile
vim Dockerfile

# Rebuild
docker build -t sandockai/sandock-python:latest .

# Push new version
docker push sandockai/sandock-python:latest
```

## Security Considerations

- Image based on official `python:3.11-slim-bookworm`
- Only includes necessary system dependencies
- Regularly update package versions to fix security vulnerabilities
- Recommended to use fixed version tags instead of `latest` in production

## Troubleshooting

### Build Failures
```bash
# Clean Docker cache
docker builder prune -a

# Rebuild without cache
docker build --no-cache -t sandockai/sandock-python:latest .
```

### Multi-platform Build Issues
```bash
# Check if buildx is available
docker buildx version

# Create new builder
docker buildx create --use --name multiarch-builder

# Check supported platforms
docker buildx inspect --bootstrap
```

## License

MIT License - Consistent with the Sandock project
