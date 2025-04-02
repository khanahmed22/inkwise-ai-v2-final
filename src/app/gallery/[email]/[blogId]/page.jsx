"use client";

import { useState, useMemo, useEffect,useRef } from "react";
import useSWR from "swr";
import { useSession, useUser } from "@clerk/nextjs";
import getSupabaseClient from "@/app/utils/supabase";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import parse from "html-react-parser";
import { slugify } from "@/app/utils/slugify";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import {
  Copy,
  ArrowLeft,
  Share2,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useSupabaseData } from "@/app/utils/SupabaseContext";

import { Separator } from "@/components/ui/separator";

import { Skeleton } from "@/components/ui/skeleton";
import { useCompletion } from "ai/react";

import { WhatsappShareButton, WhatsappIcon } from "next-share";

import { TwitterShareButton, TwitterIcon } from "next-share";

import { FacebookShareButton, FacebookIcon } from "next-share";

export default function PublicBlogPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [fileURL, setFileURL] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [authorAvatar, setAuthorAvatar] = useState("");

  const router = useRouter();
  const { blogId: id } = useParams();
  const { user } = useUser();
  const { session } = useSession();

 
  const [actionType, setActionType] = useState(null);
  const authorName = user?.firstName;

  const { countData, setCountData } = useSupabaseData();
  const [currentCount, setCurrentCount] = useState(countData[0]?.count || 0);
  const [slug, setNewSlug] = useState(slugify(name));
  const pathname = usePathname()
  const allowCopy = useRef(false); 

  function copyUrl() {
    allowCopy.current = true; 
    const el = document.createElement('input');
    el.value = window.location.href;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    allowCopy.current = false; 
    toast.success('Copied To Clipboard');
  }

  useEffect(() => {
    setCurrentCount(countData[0]?.count || 0);
  }, [countData]);

  const { complete, completion } = useCompletion({
    api:
      actionType === "paraphrase"
        ? "/api/rephrase"
        : actionType === "summarize"
        ? "/api/summarize"
        : actionType === "spellcheck"
        ? "/api/spellchecker"
        : actionType === "generateBlog"
        ? "/api/generateBlog"
        : "",
    body: { text: blogContent },
  });

  const {
    data: blog,
    mutate,
    isLoading: isBlogLoading,
    error: blogError,
  } = useSWR(id ? ["slug", id] : null, async () => {
    if (user) {
      const clerkToken = await session?.getToken({ template: "supabase" });
      const client = clerkToken
        ? getSupabaseClient(clerkToken)
        : getSupabaseClient();
      const { data, error } = await client
        .from("all_tasks")
        .select()
        .eq("slug", id)
        .single();
      if (error) throw error;
      return data;
    } else {
     
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("all_tasks")
        .select()
        .eq("slug", id)
        .single();
      if (error) throw error;
      return data;
    }
  });

  useMemo(() => {
    if (blog) {
      setName(blog.name);
      setDescription(blog.description);
      setBlogContent(blog.blogContent);
      setFileURL(blog.fileURL);
      setAuthorEmail(blog.email);
      setAuthorAvatar(blog.authorAvatar);
    }
  }, [blog]);

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  useEffect(() => {
    setNewSlug(slugify(name));
  }, [name]);

 
  if (isBlogLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Skeleton className="h-10 w-32 mb-4" />

            <div className="flex justify-between items-start mb-6">
              <div className="w-full max-w-2xl">
                <Skeleton className="h-12 w-3/4 mb-4" />
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-2/3" />

                <div className="flex items-center mt-4">
                  <Skeleton className="h-6 w-32 mr-4" />
                  <Skeleton className="h-6 w-40" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          </div>

          <Skeleton className="w-full h-[400px] mb-8 rounded-lg" />

          <div className="space-y-4 mb-12">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>

          <Separator className="my-8" />

          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-40" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }


  if (blogError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl text-destructive">
              Error Loading Blog
            </CardTitle>
            <CardDescription>
              We couldn&apos;t load the blog post you requested. It may have
              been deleted or you may not have permission to view it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Error details: {blogError.message || "Unknown error"}
            </p>
            <Button onClick={() => router.push("/gallery")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Gallery
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (true) {
    
    return (
      <div className="min-h-screen bg-background px-2">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4"
              onClick={() => router.push("/gallery")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Gallery
            </Button>

            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl mb-2">
                  {name}
                </h1>
                <p className="text-muted-foreground text-lg">{description}</p>

                <div className="flex  items-center max-md:gap-x-5 mt-4 text-sm text-muted-foreground">
                  {blog?.created_at && (
                    <div className="flex items-center mr-4">
                      <Calendar className="mr-1 h-4 w-4" />
                      <span className="max-md:text-sm">
                        {formatDate(blog.created_at)}
                      </span>
                    </div>
                  )}
                  {authorEmail && (
                    <div className="flex max-md:flex-col items-center">
                      
                      <img
                        src={authorAvatar || "/placeholder.svg"}
                        className="w-7 rounded-3xl mr-2"
                      />
                      <span>{authorName}</span>
                      <Button
                        variant="link"
                        className="ml-1 p-0 h-auto text-sm text-primary"
                        onClick={() =>
                          router.push(
                            `/gallery/author/${encodeURIComponent(authorEmail)}`
                          )
                        }
                      >
                        View Author Profile
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {fileURL && (
            <div className="mb-8 rounded-lg overflow-hidden">
              <img
                className="w-full h-[400px] object-cover"
                src={fileURL || "/placeholder.svg"}
                alt={name || "Blog cover"}
              />
            </div>
          )}

          <div className="prose prose-lg max-w-none dark:prose-invert mb-12">
            {parse(blogContent)}
          </div>

          <Separator className="my-8" />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Share2 className="mr-2 h-5 w-5" />
                Share this article with the world
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-4">
                <FacebookShareButton
                  url={`https://inkwise-ai.vercel.app/${pathname}`}
                  
                  hashtag={"#happyblogging"}
                >
                  <FacebookIcon size={32} round />
                </FacebookShareButton>

                <TwitterShareButton
                  url={`https://inkwise-ai.vercel.app/${pathname}`}
                  title={
                    "next-share is a social share buttons for your next React apps."
                  }
                >
                  <TwitterIcon size={32} round />
                </TwitterShareButton>
                <WhatsappShareButton
                  url={`https://inkwise-ai.vercel.app/${pathname}`}
                  title={
                    "next-share is a social share buttons for your next React apps."
                  }
                  separator=":: "
                >
                  <WhatsappIcon size={32} round />

                  
                </WhatsappShareButton>

                <Copy className="cursor-pointer " onClick={copyUrl}/>

               
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } else {
    if (isBlogLoading) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="min-h-screen bg-background"
        >
          <div className="flex">
            {/*<SideBar />*/}
            <div className="flex-1 p-6">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <Skeleton className="h-10 w-40 mb-2" />
                    <Skeleton className="h-5 w-64" />
                  </div>
                  <Skeleton className="h-8 w-48" />
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <Skeleton className="h-7 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-20" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-40" />
                        </div>
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Skeleton className="h-7 w-32 mb-1" />
                      <Skeleton className="h-5 w-64" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-[400px] w-full mb-6" />
                      <div className="mt-6">
                        <Skeleton className="h-5 w-32 mb-3" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }
  }
}
