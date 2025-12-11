"""Add service_access_token to Machine model

Revision ID: add_service_access_token
Revises: f7b3074be5ba
Create Date: 2025-01-05 12:00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_service_access_token'
down_revision = 'f7b3074be5ba'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add service_access_token column to machine table
    op.add_column('machine', sa.Column('service_access_token', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove service_access_token column from machine table
    op.drop_column('machine', 'service_access_token')