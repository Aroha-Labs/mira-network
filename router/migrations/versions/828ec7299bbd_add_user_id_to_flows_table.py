"""add user_id to flows table

Revision ID: 828ec7299bbd
Revises: 76361c5b2f95
Create Date: 2025-04-04 14:27:59.298766

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '828ec7299bbd'
down_revision: Union[str, None] = '76361c5b2f95'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('flows', sa.Column('user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f('ix_flows_user_id'), 'flows', ['user_id'], unique=False)
    
    op.execute("UPDATE flows SET user_id = 'system' WHERE user_id IS NULL")
    
    op.alter_column('flows', 'user_id', nullable=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_flows_user_id'), table_name='flows')
    op.drop_column('flows', 'user_id')
