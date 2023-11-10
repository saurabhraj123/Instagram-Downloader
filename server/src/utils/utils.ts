import axios from "axios";
import _ from "lodash";

const getImageDownloadLink = (data: any) => {
  return [
    {
      type: "image",
      url: _.get(data, "graphql.shortcode_media.display_url"),
    },
  ];
};

const getVideoDownloadLink = (data: any) => {
  return [
    {
      type: "video",
      url: _.get(data, "graphql.shortcode_media.video_url"),
    },
  ];
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

  return downloadLinks;
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
    return mediaTypeToFunctionMap[graphType](data);
  } catch (e) {
    console.log("e", e);
    return { error: e };
  }
};
