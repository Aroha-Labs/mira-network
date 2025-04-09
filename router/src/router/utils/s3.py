import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException
import mimetypes
from src.router.core.config import (
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    S3_BUCKET_NAME,
    S3_PREFIX,
)
from src.router.utils.logger import logger
from typing import BinaryIO, Optional, Tuple
import os

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)

def get_s3_key(filename: str) -> str:
    """Generate S3 key with proper prefix"""
    return f"{S3_PREFIX.rstrip('/')}/{filename}"

async def upload_file_to_s3(file: BinaryIO, filename: str, content_type: Optional[str] = None) -> Tuple[str, str]:
    """
    Upload a file to S3.
    
    Args:
        file: File-like object to upload
        filename: Original filename
        content_type: Optional content type, will be guessed if not provided
        
    Returns:
        Tuple of (s3_key, public_url)
    """
    try:
        if not content_type:
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or 'application/octet-stream'
            
        s3_key = get_s3_key(filename)
        
        # Upload file to S3 without ACL
        s3_client.upload_fileobj(
            file,
            S3_BUCKET_NAME,
            s3_key,
            ExtraArgs={
                'ContentType': content_type,
            }
        )
        
        # Generate the public URL - this will work if bucket policy allows public read
        public_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
        
        logger.info(f"Successfully uploaded file to S3: {s3_key}")
        return s3_key, public_url
        
    except ClientError as e:
        logger.error(f"Failed to upload file to S3: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload file to S3")

async def delete_file_from_s3(s3_key: str) -> bool:
    """
    Delete a file from S3.
    
    Args:
        s3_key: The S3 key of the file to delete
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        s3_client.delete_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key
        )
        logger.info(f"Successfully deleted file from S3: {s3_key}")
        return True
    except ClientError as e:
        logger.error(f"Failed to delete file from S3: {str(e)}")
        return False

async def get_file_from_s3(s3_key: str) -> Optional[dict]:
    """
    Get file metadata and generate presigned URL from S3.
    
    Args:
        s3_key: The S3 key of the file
        
    Returns:
        dict: File metadata including presigned URL if successful, None otherwise
    """
    try:
        # Get object metadata
        response = s3_client.head_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key
        )
        
        # Generate presigned URL (valid for 1 hour)
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': S3_BUCKET_NAME,
                'Key': s3_key
            },
            ExpiresIn=3600
        )
        
        return {
            'content_type': response.get('ContentType'),
            'content_length': response.get('ContentLength'),
            'last_modified': response.get('LastModified'),
            'presigned_url': presigned_url
        }
        
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            return None
        logger.error(f"Error accessing file in S3: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to access file in S3") 
