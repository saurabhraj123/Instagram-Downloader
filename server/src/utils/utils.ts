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
    const headers = {
      "User-Agent":
        " Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    };

    const { data } = await axios.get(url, { headers });

    if (data.error) return { error: "Internal server error" };

    const graphType = _.get(data, "graphql.shortcode_media.__typename");

    if (!graphType) return { error: "Internal server error" };

    return mediaTypeToFunctionMap[graphType](data);
  } catch (e) {
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

const getIgContainerId = async ({
  url,
  mediaType,
  caption,
  locationId,
  is_carousel_item,
}: any) => {
  const id = process.env.IG_PAGE_ID;
  const urlParamName = mediaType === "image" ? "image_url" : "video_url";
  const media_type = urlParamName === "video_url" ? "REELS" : undefined;

  const access_token = process.env.FACEBOOK_ACCESS_TOKEN;

  const payload = {
    [urlParamName]: url,
    access_token,
    caption,
    location_id: locationId,
    is_carousel_item,
    media_type,
  };

  const filteredPayload = _.pickBy(payload, (value) => value !== undefined);
  console.log({ payload2: filteredPayload });
  try {
    const { data } = await axios.post(
      `https://graph.facebook.com/v18.0/${id}/media`,
      filteredPayload
    );

    return data.id;
  } catch (e) {
    console.log({ e });
    return null;
  }
};

const postByCreationId = async (creationId: string) => {
  const id = process.env.IG_PAGE_ID;
  const access_token = process.env.FACEBOOK_ACCESS_TOKEN;

  console.log({ creationId, access_token });

  try {
    const { data } = await axios.post(
      `https://graph.facebook.com/v18.0/${id}/media_publish`,
      {
        creation_id: creationId,
        access_token,
      }
    );

    console.log({ data });

    return data.id;
  } catch (e) {
    console.log(JSON.stringify(e));
    return null;
  }
};

const getCarouselContainerId = async ({ containerIds, caption }: any) => {
  const id = process.env.IG_PAGE_ID;
  const access_token = process.env.FACEBOOK_ACCESS_TOKEN;

  try {
    const { data } = await axios.post(
      `https://graph.facebook.com/v18.0/${id}/media`,
      {
        media_type: "CAROUSEL",
        children: containerIds.join(","),
        caption,
        access_token,
      }
    );

    return data.id;
  } catch (e) {
    return null;
  }
};

const getPostUrl = async (postId: string) => {
  const access_token = process.env.FACEBOOK_ACCESS_TOKEN;

  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v18.0/${postId}`,
      {
        params: {
          fields: "permalink",
          access_token,
        },
      }
    );
    console.log({ data });
    return data.permalink;
  } catch (e) {
    console.log({ e });
    return null;
  }
};

export const uploadMedia = async (data: any) => {
  const { type } = data;

  if (type === "sidecar") {
    const containerIds = await Promise.all(
      _.map(data.edges, async (edge: any) => {
        const containerId = await getIgContainerId({
          url: edge.url,
          mediaType: edge.type,
          locationId: data?.location?.id,
          is_carousel_item: true,
        });

        return containerId;
      })
    );

    const filteredContainerIds = _.compact(containerIds);
    const creationId = await getCarouselContainerId({
      containerIds: filteredContainerIds,
      caption: data.title,
    });

    const postId = await postByCreationId(creationId);
    if (!postId) return { error: "Unable to post by creation ID" };

    const postUrl = await getPostUrl(postId);

    return { id: postId, url: postUrl };
  } else {
    const payload = {
      url: data.url,
      caption: data.title,
      mediaType: data.type,
      locationId: data?.location?.id,
    };

    console.log({ payload });

    const containerId = await getIgContainerId(payload);

    console.log({ containerId });
    if (!containerId) return { error: "Unable to get container ID" };

    const postId = await postByCreationId(containerId);
    if (!postId) return { error: "Unable to get creation ID" };

    const postUrl = await getPostUrl(postId);

    return { id: postId, url: postUrl };
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
