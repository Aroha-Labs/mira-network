import React, { ComponentProps } from "react";
import { API_BASE_URL } from "src/config";

const ProfileImage: React.FC<ComponentProps<"img">> = ({ src, ...props }) => {
  if (!src) return null;
  const proxyUrl = `${API_BASE_URL}/proxy-image?url=${encodeURIComponent(src)}`;
  return <img src={proxyUrl} {...props} />;
};

export default ProfileImage;
