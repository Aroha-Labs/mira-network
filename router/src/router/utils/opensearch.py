from opensearchpy import OpenSearch, RequestsHttpConnection
from src.router.core.config import (
    OPENSEARCH_BASE_URL,
    OPENSEARCH_USER,
    OPENSEARCH_PASSWORD,
)

OPENSEARCH_MODEL_USAGE_INDEX = "mira-model-usage"
OPENSEARCH_CREDITS_INDEX = "mira-credits-history"

opensearch_client = OpenSearch(
    hosts=[OPENSEARCH_BASE_URL],
    http_auth=(OPENSEARCH_USER, OPENSEARCH_PASSWORD),
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection,
)

# opensearch_client = OpenSearch(
#     hosts=["http://localhost:9200"],
#     # http_auth=(OPENSEARCH_USER, OPENSEARCH_PASSWORD),
#     # use_ssl=True,
#     # verify_certs=True,
#     connection_class=RequestsHttpConnection,
# )
