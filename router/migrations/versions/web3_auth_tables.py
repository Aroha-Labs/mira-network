"""create web3 auth tables

Revision ID: web3_auth_tables
Revises: # You'll need to update this with your last migration
Create Date: 2024-02-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'web3_auth_tables'
down_revision = None  # Update this with your last migration
branch_labels = None
depends_on = None


def upgrade():
    # Create user_wallets table
    op.create_table(
        'user_wallets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('wallet_address', sa.String(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('wallet_address', name='unique_wallet_address')
    )
    
    # Create index on user_id
    op.create_index('idx_user_wallets_user_id', 'user_wallets', ['user_id'])
    
    # Create index on wallet_address
    op.create_index('idx_user_wallets_wallet_address', 'user_wallets', ['wallet_address'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_user_wallets_wallet_address')
    op.drop_index('idx_user_wallets_user_id')
    
    # Drop table
    op.drop_table('user_wallets') 