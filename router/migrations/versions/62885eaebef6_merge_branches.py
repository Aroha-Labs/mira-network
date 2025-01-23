"""merge branches

Revision ID: 62885eaebef6
Revises: 6813c02bd742, a216eb44cd59
Create Date: 2025-01-21 15:57:47.427106

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '62885eaebef6'
down_revision: Union[str, None] = ('6813c02bd742', 'a216eb44cd59')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
