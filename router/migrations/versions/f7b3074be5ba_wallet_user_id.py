"""wallet user id

Revision ID: f7b3074be5ba
Revises: f69bace5a14b
Create Date: 2025-02-02 19:03:15.239425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f7b3074be5ba'
down_revision: Union[str, None] = 'f69bace5a14b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Convert user_id to UUID with proper casting
    op.alter_column('wallet', 'user_id',
        type_=postgresql.UUID(as_uuid=True),
        postgresql_using="user_id::uuid",
        existing_type=sa.String(),
        nullable=False
    )


def downgrade() -> None:
    op.alter_column('wallet', 'user_id',
        type_=sa.String(),
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )
