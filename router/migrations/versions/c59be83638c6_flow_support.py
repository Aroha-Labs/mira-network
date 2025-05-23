"""flow support

Revision ID: c59be83638c6
Revises: 62885eaebef6
Create Date: 2025-01-21 15:58:10.280173

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'c59be83638c6'
down_revision: Union[str, None] = '62885eaebef6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('apilogs', sa.Column('flow_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f('ix_apilogs_flow_id'), 'apilogs', ['flow_id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_apilogs_flow_id'), table_name='apilogs')
    op.drop_column('apilogs', 'flow_id')
    # ### end Alembic commands ###
