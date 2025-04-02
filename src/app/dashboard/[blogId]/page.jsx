"use client"

import { useState, useRef, useMemo, useEffect } from "react"
import useSWR from "swr"
import JoditEditor from "jodit-react"
import { useSession, useUser } from "@clerk/nextjs"
import getSupabaseClient from "@/app/utils/supabase"
import { useRouter, useParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useCompletion } from "ai/react"
import parse from "html-react-parser"
import { slugify } from "@/app/utils/slugify"
import {
  Sparkles,
  ChevronLeft,
  Pencil,
  Save,
  Trash,
  ImageUp,
  FileText,
  Wand2,
  CheckCircle2,
  ArrowLeft,
  Share2,
  Calendar,
  User,
  Loader2,
  Copy
} from "lucide-react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useSupabaseData } from "@/app/utils/SupabaseContext"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WhatsappShareButton, WhatsappIcon } from "next-share";

import { TwitterShareButton, TwitterIcon } from "next-share";

import { FacebookShareButton, FacebookIcon } from "next-share";
import { usePathname } from "next/navigation"

export default function BlogPage() {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [blogContent, setBlogContent] = useState("")
  const [fileURL, setFileURL] = useState("")
  const [existingFilePath, setExistingFilePath] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [slug, setNewSlug] = useState(slugify(name))
  const router = useRouter()
  const { blogId: id } = useParams()
  const { user } = useUser()
  const { session } = useSession()
  const editorRef = useRef(null)

  const email = user?.primaryEmailAddress?.emailAddress || ""
  
  const [actionType, setActionType] = useState(null)

  const { countData, setCountData } = useSupabaseData()
  const [currentCount, setCurrentCount] = useState(countData[0]?.count || 0)

  const [prompt, setPrompt] = useState("")
  const [imageSrc, setImageSrc] = useState(null)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState(null)
  const [genre, setGenre] = useState("")
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
    setCurrentCount(countData[0]?.count || 0)
  }, [countData])

  const {
    complete,
    completion,
    isLoading: aiLoading,
  } = useCompletion({
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
  })

  const {
    data: blog,
    mutate,
    isLoading: isBlogLoading,
    error: blogError,
  } = useSWR(user && id ? ["slug", id] : null, async () => {
    const clerkToken = await session?.getToken({ template: "supabase" })
    const client = getSupabaseClient(clerkToken)
    const { data, error } = await client.from("tasks").select().eq("slug", id).single()
    if (error) throw error
    return data
  })

  useMemo(() => {
    if (blog) {
      setName(blog.name)
      setDescription(blog.description)
      setBlogContent(blog.blogContent)
      setFileURL(blog.fileURL)
      setGenre(blog.genre || "")
    }
  }, [blog])

  async function deleteBlog() {
    const clerkToken = await session?.getToken({ template: "supabase" })
    const client = getSupabaseClient(clerkToken)

    try {
   
      await client.from("tasks").delete().eq("slug", id)
      await client.from("all_tasks").delete().eq("slug", id)

      mutate()
      toast.success("Blog deleted successfully")
      router.push("/dashboard")
    } catch (error) {
      toast.error("Error deleting blog: " + error.message)
    }
  }

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
  }

  const handleUpload = async () => {
    const clerkToken = await session?.getToken({ template: "supabase" })
    const client = getSupabaseClient(clerkToken)

    try {
      setUploading(true)

      if (!file) {
        toast.info("Please select a file to upload")
        return
      }

      const fileExt = file.name.split(".").pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      if (existingFilePath) {
        const { error: deleteError } = await client.storage.from("images").remove([existingFilePath])
        if (deleteError) {
          throw deleteError
        }
      }

      const { data, error } = await client.storage.from("images").upload(filePath, file)
      if (error) {
        throw error
      }

      const { data: publicUrlData, error: urlError } = client.storage.from("images").getPublicUrl(filePath)
      if (urlError) {
        throw urlError
      }

      setFileURL(publicUrlData.publicUrl)
      setExistingFilePath(filePath)

      toast.success("File uploaded successfully")
    } catch (error) {
      toast.error("Error uploading file: " + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleUploadGeneratedImage = async () => {
    if (!imageSrc) {
      toast.info("Please generate an image first")
      return
    }

    try {
      setUploading(true)

   
      const response = await fetch(imageSrc)
      const blob = await response.blob()


      const fileName = `ai-generated-${Math.random()}.png`
      const aiGeneratedFile = new File([blob], fileName, { type: "image/png" })


      const clerkToken = await session?.getToken({ template: "supabase" })
      const client = getSupabaseClient(clerkToken)

     
      if (existingFilePath) {
        const { error: deleteError } = await client.storage.from("images").remove([existingFilePath])
        if (deleteError) {
          console.error("Error deleting existing file:", deleteError)
        }
      }

   
      const { data, error } = await client.storage.from("images").upload(fileName, aiGeneratedFile)

      if (error) {
        throw error
      }

      const { data: publicUrlData, error: urlError } = client.storage.from("images").getPublicUrl(fileName)

      if (urlError) {
        throw urlError
      }

    
      setFileURL(publicUrlData.publicUrl)
      setExistingFilePath(fileName)

      toast.success("AI-generated image uploaded successfully")
    } catch (error) {
      toast.error("Error uploading AI-generated image: " + error.message)
    } finally {
      setUploading(false)
    }
  }

  const createOrUpdateBlog = async (e) => {
    e.preventDefault()
    const clerkToken = await session?.getToken({ template: "supabase" })
    const client = getSupabaseClient(clerkToken)

    try {
      if (id) {
      
        await client
          .from("tasks")
          .update({
            name,
            description,
            blogContent,
            fileURL,
            slug: slug,
            genre,
          })
          .eq("slug", id)

        
        await client
          .from("all_tasks")
          .update({
            name,
            description,
            blogContent,
            fileURL,
            slug: slug,
            genre,
          })
          .eq("slug", id)
      } else {
     
        const blogData = {
          name,
          email,
          description,
          blogContent,
          fileURL,
          slug: slug,
          genre,
        }

        await client.from("tasks").insert(blogData)
        await client.from("all_tasks").insert(blogData)
      }
      mutate()
      setFile(null)
      toast.success("Blog saved successfully")
      setEditMode(false)

      if (!id || id !== slug) {
        router.push(`/blog/${slug}`)
      }

      router.push("/dashboard")
    } catch (error) {
      toast.error("Error saving blog: " + error.message)
    }
  }

  const updateCountInSupabase = async (newCount) => {
    const clerkToken = await session?.getToken({ template: "supabase" })
    const client = getSupabaseClient(clerkToken)

    const { error } = await client.from("ai-table").update({ count: newCount }).eq("user_id", user.id)

    if (error) {
      console.error("Error updating count in Supabase:", error)
      toast.error("Failed to update AI usage count")
      return false
    }
    return true
  }

  const handleAiAction = async (type) => {
    if (!blogContent) {
      toast.error("Text field is empty. Write something first.")
      return
    }

    if (currentCount <= 0) {
      toast.error("You've used all your AI actions. Please upgrade your plan.")
      return
    }

    setLoading(true)
    setActionType(type)

    try {
      const newCount = currentCount - 1
      const updated = await updateCountInSupabase(newCount)

      if (updated) {
        setCurrentCount(newCount)
        setCountData([{ ...countData[0], count: newCount }])
        await complete(blogContent)
      }
    } catch (error) {
      toast.error("Error processing AI action: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (completion) {
      setBlogContent(completion)
      let successMessage = ""
      if (actionType === "paraphrase") {
        successMessage = "Blog content rephrased successfully"
      } else if (actionType === "summarize") {
        successMessage = "Blog content summarized successfully"
      } else if (actionType === "spellcheck") {
        successMessage = "Spelling checked and corrected successfully"
      } else if (actionType === "generateBlog") {
        successMessage = "Blog generated successfully"
      }
      toast.success(successMessage)
    }
  }, [completion, actionType])

  const config = useMemo(
    () => ({
      placeholder: "Start writing your blog content here...",
      width: "100%",
      height: "400px",
      uploader: {
        insertImageAsBase64URI: true,
        url: "https://freeimage.host/api/1/upload",
        filesVariableName: (i) => `source[${i}]`,
        headers: {
          Authorization: `Client-ID ${process.env.NEXT_PUBLIC_FREE_IMAGE_HOST_KEY}`,
        },
        format: "json",
        isSuccess: (resp) => !resp.error,
        process: (resp) => ({
          files: resp.image ? [resp.image.url] : [],
          path: resp.image ? resp.image.url : "",
          error: resp.error,
        }),
      },
    }),
    [],
  )

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date"
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date)
  }

  useEffect(() => {
    setNewSlug(slugify(name))
  }, [name])

  const fetchImage = async () => {
    setGeneratingImage(true)
    setImageError(null)

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        throw new Error(`Server Error: ${response.status}`)
      }

      const { image } = await response.json()
      setImageSrc(image)
    } catch (err) {
      setImageError(err.message)
    } finally {
      setGeneratingImage(false)
    }
  }

  if (isBlogLoading && !editMode) {
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
    )
  }


  if (blogError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl text-destructive">Error Loading Blog</CardTitle>
            <CardDescription>
              We couldn&apos;t load the blog post you requested. It may have been deleted or you may not have permission to
              view it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Error details: {blogError.message || "Unknown error"}</p>
            <Button onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!editMode) {
  
    return (
      <div className="min-h-screen bg-background px-2">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>

            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl mb-2">{name}</h1>
                <p className="text-muted-foreground text-lg">{description}</p>

                {blog?.genre && (
                  <Badge variant="secondary" className="mt-2">
                    {blog.genre}
                  </Badge>
                )}

                <div className="flex items-center mt-4 text-sm text-muted-foreground">
                  {blog?.created_at && (
                    <div className="flex items-center mr-4">
                      <Calendar className="mr-1 h-4 w-4" />
                      <span>{formatDate(blog.created_at)}</span>
                    </div>
                  )}
                  
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)} aria-label="Edit blog">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" aria-label="Delete blog">
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your blog post.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <Button variant="destructive" onClick={deleteBlog}>
                        Delete
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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

          <div className="prose prose-lg max-w-none dark:prose-invert mb-12">{parse(blogContent)}</div>

          <Separator className="my-8" />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Share2 className="mr-2 h-5 w-5" />
                Share this article with yourself
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
    )
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
      )
    }

    
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
                  <h1 className="text-3xl font-bold tracking-tight">Edit Blog</h1>
                  <p className="text-muted-foreground mt-1">Make changes to your blog post</p>
                </div>
                <Badge variant="outline" className="px-3 py-1.5">
                  <Sparkles className="w-4 h-4 mr-1.5 text-primary" />
                  <span className="font-medium">{currentCount} AI actions remaining</span>
                </Badge>
              </div>

              <form onSubmit={createOrUpdateBlog}>
                <Tabs defaultValue="content" className="w-full">
                  <TabsList className="grid grid-cols-2 mb-6">
                    <TabsTrigger value="content">
                      <FileText className="w-4 h-4 mr-2" />
                      Content
                    </TabsTrigger>
                    <TabsTrigger value="media">
                      <ImageUp className="w-4 h-4 mr-2" />
                      Featured Image
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="content" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xl">Blog Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="title" className="text-sm font-medium">
                            Blog Title
                          </label>
                          <Input
                            id="title"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter a compelling title"
                            className="h-12"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="description" className="text-sm font-medium">
                            Description
                          </label>
                          <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add a brief description or subtitle"
                            className="min-h-[80px] resize-none"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="genre" className="text-sm font-medium">
                            Genre
                          </label>
                          <Select value={genre} onValueChange={setGenre}>
                            <SelectTrigger id="genre" className="h-12">
                              <SelectValue placeholder="Select a genre" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="uncategorized">Uncategorized</SelectItem>
                              <SelectItem value="Technology">Technology</SelectItem>
                              <SelectItem value="Travel">Travel</SelectItem>
                              <SelectItem value="Food">Food</SelectItem>
                              <SelectItem value="Lifestyle">Lifestyle</SelectItem>
                              <SelectItem value="Health">Health</SelectItem>
                              <SelectItem value="Fitness">Fitness</SelectItem>
                              <SelectItem value="Business">Business</SelectItem>
                              <SelectItem value="Finance">Finance</SelectItem>
                              <SelectItem value="Education">Education</SelectItem>
                              <SelectItem value="Entertainment">Entertainment</SelectItem>
                              <SelectItem value="Science">Science</SelectItem>
                              <SelectItem value="Art">Art</SelectItem>
                              <SelectItem value="Fashion">Fashion</SelectItem>
                              <SelectItem value="Sports">Sports</SelectItem>
                              <SelectItem value="Politics">Politics</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="slug" className="text-sm font-medium">
                            URL Slug
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="slug"
                              type="text"
                              value={slug}
                              onChange={(e) => setNewSlug(e.target.value)}
                              placeholder="blog-post-url"
                              className="h-12"
                              required
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setNewSlug(slugify(name))}
                              className="h-12 whitespace-nowrap"
                            >
                              Generate from Title
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">This will be used in the URL: /blog/{slug}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xl">Blog Content</CardTitle>
                        <CardDescription>Use the editor below to write your blog content</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <JoditEditor
                          ref={editorRef}
                          value={blogContent}
                          config={config}
                          onChange={(newContent) => setBlogContent(newContent)}
                          className="text-black"
                        />

                        <div className="mt-6">
                          <h3 className="text-sm font-medium mb-3">AI Assistance</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 justify-start"
                              onClick={() => handleAiAction("paraphrase")}
                              disabled={currentCount <= 0 || loading}
                            >
                              <Wand2 className="w-4 h-4 mr-2" />
                              {loading && actionType === "paraphrase" ? "Rephrasing..." : "Rephrase with AI"}
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 justify-start"
                              onClick={() => handleAiAction("summarize")}
                              disabled={currentCount <= 0 || loading}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              {loading && actionType === "summarize" ? "Summarizing..." : "Summarize with AI"}
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 justify-start"
                              onClick={() => handleAiAction("spellcheck")}
                              disabled={currentCount <= 0 || loading}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              {loading && actionType === "spellcheck" ? "Checking..." : "Spellcheck with AI"}
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 justify-start"
                              onClick={() => handleAiAction("generateBlog")}
                              disabled={currentCount <= 0 || loading}
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              {loading && actionType === "generateBlog" ? "Generating..." : "Generate Blog with AI"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="media">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xl">Featured Image</CardTitle>
                        <CardDescription>Upload a high-quality image to represent your blog post</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div className="space-y-4">
                            <h3 className="text-sm font-medium">Upload Your Own Image</h3>
                            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                              <div className="flex-1">
                                <label htmlFor="image-upload" className="text-sm font-medium block mb-2">
                                  Upload Image (Max: 50MB)
                                </label>
                                <Input
                                  id="image-upload"
                                  type="file"
                                  onChange={handleFileChange}
                                  className="cursor-pointer"
                                  accept="image/*"
                                  aria-label="Select file to upload"
                                />
                              </div>
                              <Button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading || !file}
                                className="min-w-[120px]"
                              >
                                {uploading ? (
                                  "Uploading..."
                                ) : (
                                  <>
                                    <ImageUp className="w-4 h-4 mr-2" />
                                    Upload
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-6 mt-8 border-t pt-6">
                            <h3 className="text-sm font-medium">Generate Image with AI</h3>
                            <div className="space-y-4">
                              <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                  <label htmlFor="image-prompt" className="text-sm font-medium block mb-2">
                                    Image Prompt
                                  </label>
                                  <Input
                                    id="image-prompt"
                                    type="text"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe the image you want to generate"
                                    className="h-12"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  onClick={fetchImage}
                                  disabled={generatingImage}
                                  className="min-w-[120px] h-12 mt-auto"
                                >
                                  {generatingImage ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Wand2 className="w-4 h-4 mr-2" />
                                      Generate
                                    </>
                                  )}
                                </Button>
                              </div>

                              {imageError && (
                                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                                  {imageError}
                                </div>
                              )}

                              {imageSrc && (
                                <div className="space-y-4">
                                  <img
                                    src={imageSrc || "/placeholder.svg"}
                                    alt="Generated"
                                    className="max-w-md rounded-md shadow-md"
                                  />
                                  <Button onClick={handleUploadGeneratedImage} disabled={uploading} variant="secondary">
                                    {uploading ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Uploading...
                                      </>
                                    ) : (
                                      <>
                                        <ImageUp className="w-4 h-4 mr-2" />
                                        Use as Featured Image
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {fileURL && (
                            <div className="mt-8 border-t pt-6">
                              <h3 className="text-sm font-medium mb-4">Selected Featured Image</h3>
                              <div className="relative rounded-md overflow-hidden border max-w-md">
                                <img
                                  src={fileURL || "/placeholder.svg"}
                                  className="w-full h-auto"
                                  alt="Blog cover preview"
                                />
                                <div className="absolute top-2 right-2">
                                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                                    <CheckCircle2 className="w-3 h-3 mr-1 text-primary" />
                                    Selected
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="flex items-center justify-between mt-6">
                  <Button type="button" variant="outline" onClick={() => setEditMode(false)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>

                  <Button type="submit" disabled={!name || !description || !blogContent}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }
}

