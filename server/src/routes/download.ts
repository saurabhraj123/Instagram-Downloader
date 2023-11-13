import { Router } from "express";
import _ from "lodash";
import { getDownloadUrl, extractIdFromUrl, uploadMedia } from "../utils/utils";

const router = Router();

router.get("/", async (req, res) => {
  const { url: postUrl } = req.query;
  const postId = extractIdFromUrl(postUrl as string);

  const endPointUrl = `https://instagram.com/p/${postId}?__a=1&__d=dis`;

  const downloadData = await getDownloadUrl(endPointUrl);

  return res.send(downloadData);
});

export default router;
