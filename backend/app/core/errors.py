class ClusterError(Exception):
    """Base for cluster-access errors. The API layer maps subclasses to HTTP codes."""


class ClusterUnreachableError(ClusterError):  # -> 503
    pass


class ClusterAccessDeniedError(ClusterError):  # -> 403
    pass


class ResourceNotFoundError(ClusterError):  # -> 404
    pass
