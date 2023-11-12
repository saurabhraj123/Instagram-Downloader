import axios from "axios";
import _ from "lodash";

const getTitle = (data: any): string => {
  return _.get(
    data,
    "graphql.shortcode_media.edge_media_to_caption.edges[0].node.text"
  );
};

const getLocation = (data: any): string => {
  return _.get(data, "graphql.shortcode_media.location.name");
};

const getImageDownloadLink = (data: any) => {
  return {
    type: "image",
    title: getTitle(data),
    location: getLocation(data),
    url: _.get(data, "graphql.shortcode_media.display_url"),
  };
};

const getVideoDownloadLink = (data: any) => {
  return {
    type: "video",
    title: getTitle(data),
    location: getLocation(data),
    url: _.get(data, "graphql.shortcode_media.video_url"),
  };
};

const getSidecarDownloadLink = (data: any) => {
  const edges = _.get(
    data,
    "graphql.shortcode_media.edge_sidecar_to_children.edges"
  );

  const downloadLinks = _.map(edges, (edge: any) => {
    const graphType = _.get(edge, "node.__typename");

    const dataType = graphType === "GraphImage" ? "image" : "video";

    if (dataType === "image")
      return {
        type: dataType,
        url: _.get(edge, "node.display_url"),
      };

    return {
      type: dataType,
      url: _.get(edge, "node.video_url"),
    };
  });

  const response = {
    type: "sidecar",
    title: getTitle(data),
    location: getLocation(data),
    edges: downloadLinks,
  };

  return response;
};

const mediaTypeToFunctionMap: any = {
  GraphImage: getImageDownloadLink,
  GraphVideo: getVideoDownloadLink,
  GraphSidecar: getSidecarDownloadLink,
};

export const getDownloadUrl = async (url: string) => {
  try {
    const { data } = await axios.get(url);

    const graphType = _.get(data, "graphql.shortcode_media.__typename");

    if (!graphType) return { error: "Internal server error" };

    return mediaTypeToFunctionMap[graphType](data);
  } catch (e) {
    console.log("e", e);
    return { error: e };
  }
};

export const isInstagramPostUrl = (url: string) => {
  const regex = /https:\/\/www.instagram.com\/(?:p|reel)\/[a-zA-Z0-9]+\/?/g;

  return regex.test(url);
};

// Function to extract ID from Instagram URLs
export const extractIdFromUrl = (url: string) => {
  if (!url) return { error: "No URL provided" };

  const match = url.match(/\/(p|reel)\/([^/]+)/);
  return match ? match[2] : null;
};

const getIgContainerId = async (
  url: string,
  mediaType: string,
  caption: string,
  location: string
) => {
  const id = process.env.IG_PAGE_ID;
  const urlParamName = mediaType === "image" ? "image_url" : "video_url";
  const access_token = process.env.FACEBOOK_ACCESS_TOKEN;

  console.log({ url, mediaType, id, urlParamName, access_token });
  try {
    const { data } = await axios.post(
      `https://graph.facebook.com/v18.0/${id}/media`,
      {
        [urlParamName]: url,
        access_token,
        caption,
        location,
      }
    );

    return data.id;
  } catch (e) {
    return null;
  }
};

const postByCreationId = async (creationId: string) => {
  const id = process.env.IG_PAGE_ID;
  const access_token = process.env.FACEBOOK_ACCESS_TOKEN;

  try {
    const { data } = await axios.post(
      `https://graph.facebook.com/v18.0/${id}/media_publish`,
      {
        creation_id: creationId,
        access_token,
      }
    );

    return data.id;
  } catch (e) {
    return null;
  }
};

export const uploadMedia = async (data: any) => {
  // console.log({ data });
  const { type } = data;
  // console.log({ type, url });

  if (type === "sidecar") {
  } else {
    const containerId = await getIgContainerId(
      data.url,
      type,
      data.title,
      data.location
    );
    if (!containerId) return { error: "Unable to get container ID" };

    const postId = await postByCreationId(containerId);
    if (!postId) return { error: "Unable to post by creation ID" };

    return { id: postId };
  }
};

export const getMenu = (data: any) => {
  const emptyText = "[not set]";
  return `
  The media is ready to publish. Please verify the details to continue:
  Media type: ${data.type ?? emptyText}
  Caption: ${data.title ?? emptyText}
  Location: ${data.location ?? emptyText}

  Please select an option to continue:
  1. Publish with these values
  2. Edit caption
  3. Edit location
  4. Get download link
  5. Discard
  `;
};
