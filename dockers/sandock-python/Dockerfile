# Sandock Python Runtime Environment
# Lightweight Python image with common data science and development packages

FROM python:3.11-slim-bookworm

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build essentials for compiling Python packages
    gcc \
    g++ \
    make \
    # Common utilities
    curl \
    wget \
    git \
    unzip \
    # Libraries for data science packages
    libgomp1 \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install build tools
RUN pip install --upgrade pip setuptools wheel

# Install Python packages in layers for better caching
# Layer 1: Core data processing (most commonly used)
RUN pip install \
    numpy==1.26.4 \
    pandas==2.2.3

# Layer 2: HTTP & Web
RUN pip install \
    requests==2.32.3 \
    httpx==0.27.2 \
    beautifulsoup4==4.12.3 \
    lxml==5.3.0

# Layer 3: File format handling
RUN pip install \
    # Excel files
    openpyxl==3.1.5 \
    # Word documents
    python-docx==1.1.2 \
    # PDF files
    PyPDF2==3.0.1 \
    pypdf==5.1.0 \
    # CSV and data
    chardet==5.2.0

# Layer 4: Utilities & Common tools
RUN pip install \
    # Environment & Config
    python-dotenv==1.0.1 \
    pyyaml==6.0.2 \
    # Date/Time
    python-dateutil==2.9.0 \
    pytz==2024.2 \
    # Image processing
    pillow==10.4.0 \
    # JSON processing
    jsonschema==4.23.0

# Layer 5: Async & Development tools
RUN pip install \
    # Async HTTP
    aiohttp==3.10.10 \
    aiofiles==24.1.0 \
    # Development
    ipython==8.28.0

# Set working directory
WORKDIR /workspace

# Create a simple entrypoint script
RUN echo '#!/bin/bash\n\
set -e\n\
exec "$@"' > /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# Verify Python installation
RUN python --version && pip --version && pip list

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command: start bash shell
CMD ["/bin/bash"]

