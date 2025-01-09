import Image from "next/image";
import React, { ComponentProps } from "react";
import { API_BASE_URL } from "src/config";

const ProfileImage: React.FC<ComponentProps<"img">> = ({
  src,
  alt = "",
  ...props
}) => {
  if (!src) return null;
  let proxyUrl = src;

  if (src.startsWith("http")) {
    proxyUrl = `${API_BASE_URL}/proxy-image?url=${encodeURIComponent(src)}`;
  }

  return <Image alt={alt} src={proxyUrl} {...props} width={100} height={100} />;
};

export default ProfileImage;
