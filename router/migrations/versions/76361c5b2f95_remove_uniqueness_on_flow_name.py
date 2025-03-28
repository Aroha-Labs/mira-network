"""remove uniqueness on flow name

Revision ID: 76361c5b2f95
Revises: 71fb79bd3089
Create Date: 2025-02-27 23:21:30.478826

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '76361c5b2f95'
down_revision: Union[str, None] = '71fb79bd3089'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint('flows_name_key', 'flows', type_='unique')
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_unique_constraint('flows_name_key', 'flows', ['name'])
    # ### end Alembic commands ###
