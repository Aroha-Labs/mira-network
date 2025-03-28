"""meta_data col for api keys

Revision ID: bbe0e549299d
Revises: 2337eba1ff88
Create Date: 2025-02-13 14:22:04.332965

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'bbe0e549299d'
down_revision: Union[str, None] = '2337eba1ff88'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('apitoken', sa.Column('meta_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('apitoken', 'meta_data')
    # ### end Alembic commands ###
