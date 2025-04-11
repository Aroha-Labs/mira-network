import newrelic.agent

def track(event_name: str, properties: dict = None):
    """
    Track an event with New Relic.
    
    :param event_name: The name of the event to track.
    :param properties: A dictionary of properties to include with the event.
    """
    try:
        if properties is None:
            properties = {}
            
        newrelic.agent.record_custom_event("mira_network_router", {
            "event_name": event_name,
            **properties
        })
    except Exception:
        pass