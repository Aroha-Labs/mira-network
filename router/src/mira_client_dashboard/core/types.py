from typing import List
from gotrue import User as GoUser


class User(GoUser):
    roles: List[str] = []
