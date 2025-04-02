"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import dynamic from "next/dynamic"
import { useSession, useUser } from "@clerk/nextjs"
import getSupabaseClient from "@/app/utils/supabase"
import { useSupabaseData } from "@/app/utils/SupabaseContext"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useCompletion } from "ai/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Sparkles, ImageUp, Type, FileText, Wand2, CheckCircle2, FileImage, Send, Link, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { slugify } from "@/app/utils/slugify"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


const JoditEditor = dynamic(() => import("jodit-react"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] border rounded-md bg-muted/20 flex items-center justify-center">Loading editor...</div>
  ),
})

export default function BlogMakerClient() {
  const [tasks, setTasks] = useState([])
  const [isLoading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [blogContent, setBlogContent] = useState("")
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [slug, setSlug] = useState("")
  const [genre, setGenre] = useState("")
  const { user } = useUser()
  const { session } = useSession()
  const editorRef = useRef(null)
  const router = useRouter()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [fileURL, setFileURL] = useState("")
  const [actionType, setActionType] = useState(null)

  const [imageSrc, setImageSrc] = useState(null)

  const [error, setError] = useState(null)
  const [prompt, setPrompt] = useState("")

  const email = user?.primaryEmailAddress?.emailAddress || ""
  const authorName = user?.firstName
  const authorAvatar = user?.imageUrl

  const { countData, setCountData } = useSupabaseData()
  const currentCount = countData?.[0]?.count || 0

  const [loading, setloading] = useState(false)


  const {
    complete: completeParaphrase,
    completion: paraphraseCompletion,
    isLoading: paraphraseLoading,
  } = useCompletion({
    api: "/api/rephrase",
    body: { text: blogContent },
  })

  const {
    complete: completeSummarize,
    completion: summarizeCompletion,
    isLoading: summarizeLoading,
  } = useCompletion({
    api: "/api/summarize",
    body: { text: blogContent },
  })

  const {
    complete: completeSpellcheck,
    completion: spellcheckCompletion,
    isLoading: spellcheckLoading,
  } = useCompletion({
    api: "/api/spellchecker",
    body: { text: blogContent },
  })

  const {
    complete: completeGenerateBlog,
    completion: generateBlogCompletion,
    isLoading: generateBlogLoading,
  } = useCompletion({
    api: "/api/generateBlog",
    body: { text: blogContent },
  })

  
  const aiLoading = paraphraseLoading || summarizeLoading || spellcheckLoading || generateBlogLoading

  useEffect(() => {
    if (!user) return

    async function loadTasks() {
      setLoading(true)
      const clerkToken = await session?.getToken({ template: "supabase" })
      const client = getSupabaseClient(clerkToken)
      const { data, error } = await client.from("tasks").select()
      if (!error) setTasks(data)
      setLoading(false)
    }

    loadTasks()
  }, [user, session])

 
  useEffect(() => {
    setSlug(slugify(name))
  }, [name])


  useEffect(() => {
    if (paraphraseCompletion) {
      setBlogContent(paraphraseCompletion)
      toast.success("Blog content rephrased successfully")
    }
  }, [paraphraseCompletion])

  useEffect(() => {
    if (summarizeCompletion) {
      setBlogContent(summarizeCompletion)
      toast.success("Blog content summarized successfully")
    }
  }, [summarizeCompletion])

  useEffect(() => {
    if (spellcheckCompletion) {
      setBlogContent(spellcheckCompletion)
      toast.success("Spelling corrected successfully")
    }
  }, [spellcheckCompletion])

  useEffect(() => {
    if (generateBlogCompletion) {
      setBlogContent(generateBlogCompletion)
      toast.success("Blog generated successfully")
    }
  }, [generateBlogCompletion])

  async function createTask(e) {
    e.preventDefault()
    const clerkToken = await session?.getToken({ template: "supabase" })
    const client = getSupabaseClient(clerkToken)

    try {
      setPublishing(true)

      if (editingTaskId) {
        await client
          .from("tasks")
          .update({
            name,
            description,
            blogContent,
            fileURL,
            slug,
            genre,
          })
          .eq("id", editingTaskId)

        setTasks(
          tasks.map((task) =>
            task.id === editingTaskId ? { ...task, name, description, blogContent, fileURL, slug, genre } : task,
          ),
        )
        setEditingTaskId(null)
      } else {
       
        const blogData = {
          name,
          email,
          authorName,
          authorAvatar,
          description,
          blogContent,
          fileURL,
          slug,
          genre,
        }

   
        const { data, error } = await client.from("tasks").insert(blogData).select()

        if (error) throw error

        const { error: allTasksError } = await client.from("all_tasks").insert(blogData)

        if (allTasksError) {
          console.error("Error inserting into all_tasks:", allTasksError)
          toast.warning("Blog saved to tasks but failed to save to all_tasks")
        }
      }

      setName("")
      setDescription("")
      setBlogContent("")
      setFileURL("")
      setSlug("")
      setGenre("")

      toast.success("Blog published successfully")
      router.push("/dashboard")
    } catch (error) {
      toast.error("Error publishing blog: " + error.message)
    } finally {
      setPublishing(false)
    }
  }

  const config = useMemo(
    () => ({
      placeholder:
        "Start writing your blog content here... or Write Topic Name with number of words for Blog made by AI",
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

      const { data, error } = await client.storage.from("images").upload(filePath, file)

      if (error) {
        throw error
      }

      const { data: publicUrlData, error: urlError } = client.storage.from("images").getPublicUrl(filePath)

      if (urlError) {
        throw urlError
      }

      setFileURL(publicUrlData.publicUrl)
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

      const { data, error } = await client.storage.from("images").upload(fileName, aiGeneratedFile)

      if (error) {
        throw error
      }

     
      const { data: publicUrlData, error: urlError } = client.storage.from("images").getPublicUrl(fileName)

      if (urlError) {
        throw urlError
      }

    
      setFileURL(publicUrlData.publicUrl)
      toast.success("AI-generated image uploaded successfully")
    } catch (error) {
      toast.error("Error uploading AI-generated image: " + error.message)
    } finally {
      setUploading(false)
    }
  }

  const updateCountInSupabase = async (newCount) => {
    const clerkToken = await session?.getToken({ template: "supabase" })
    const client = getSupabaseClient(clerkToken)

    const { error } = await client.from("ai_table").update({ count: newCount }).eq("email", email)

    if (error) {
      console.error("Error updating count in Supabase:", error)
      toast.error("Failed to update AI usage count")
    }
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

    setActionType(type)

    const newCount = currentCount - 1
    setCountData([{ ...countData[0], count: newCount }])

    await updateCountInSupabase(newCount)

    
    switch (type) {
      case "paraphrase":
        completeParaphrase(blogContent)
        break
      case "summarize":
        completeSummarize(blogContent)
        break
      case "spellcheck":
        completeSpellcheck(blogContent)
        break
      case "generateBlog":
        completeGenerateBlog(blogContent)
        break
      default:
        break
    }
  }

  const fetchImage = async () => {
    setloading(true)
    setError(null)

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
      setError(err.message)
    } finally {
      setloading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/*<SideBar />*/}
      <div className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Blog Maker</h1>
              <p className="text-muted-foreground mt-1">Create and publish your blog post</p>
            </div>
            <Badge variant="outline" className="px-3 py-1.5">
              <Sparkles className="w-4 h-4 mr-1.5 text-primary" />
              <span className="font-medium">
                {currentCount} AI actions remaining{" "}
                <span
                  className="font-semibold text-red-500 hover:underline hover:text-red-600 hover:font-bold ml-2 cursor-pointer"
                  onClick={() => router.push("/pricing")}
                >
                  Upgrade
                </span>
              </span>
            </Badge>
          </div>

          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="content">
                <FileText className="w-4 h-4 mr-2" />
                Content
              </TabsTrigger>
              <TabsTrigger value="media">
                <FileImage className="w-4 h-4 mr-2" />
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
                      <Type className="w-4 h-4 inline mr-2" />
                      Blog Title
                    </label>
                    <Input
                      id="title"
                      autoFocus
                      type="text"
                      placeholder="Enter a compelling title"
                      onChange={(e) => setName(e.target.value)}
                      value={name}
                      required
                      className="h-12"
                      aria-label="Blog Title"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Description
                    </label>
                    <Input
                      id="description"
                      type="text"
                      placeholder="Add a brief description or subtitle"
                      onChange={(e) => setDescription(e.target.value)}
                      value={description}
                      required
                      className="h-12"
                      aria-label="Blog Description"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="genre" className="text-sm font-medium">
                      <FileText className="w-4 h-4 inline mr-2" />
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
                      <Link className="w-4 h-4 inline mr-2" />
                      URL Slug
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="slug"
                        type="text"
                        placeholder="blog-post-url"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        required
                        className="h-12"
                        aria-label="URL Slug"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSlug(slugify(name))}
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
                </CardHeader>
                <CardContent>
                  <form onSubmit={createTask}>
                    {JoditEditor && (
                      <JoditEditor
                        ref={editorRef}
                        value={blogContent}
                        config={config}
                        onChange={(newContent) => setBlogContent(newContent)}
                        className="text-black"
                      />
                    )}

                    <div className="mt-6">
                      <h3 className="text-sm font-medium mb-3">AI Assistance</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 justify-start"
                          onClick={() => handleAiAction("paraphrase")}
                          disabled={currentCount <= 0 || aiLoading}
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          {paraphraseLoading ? "Rephrasing..." : "Rephrase with AI"}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 justify-start"
                          onClick={() => handleAiAction("summarize")}
                          disabled={currentCount <= 0 || aiLoading}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {summarizeLoading ? "Summarizing..." : "Summarize with AI"}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 justify-start"
                          onClick={() => handleAiAction("spellcheck")}
                          disabled={currentCount <= 0 || aiLoading}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {spellcheckLoading ? "Checking..." : "Spellcheck with AI"}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 justify-start"
                          onClick={() => handleAiAction("generateBlog")}
                          disabled={currentCount <= 0 || aiLoading}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {generateBlogLoading ? "Generating..." : "Generate Blog with AI"}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full md:w-auto"
                        disabled={publishing || !name || !description || !blogContent || !slug}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {publishing ? "Publishing..." : "Publish Blog To Gallery"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="media">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Featured Image</CardTitle>
                </CardHeader>
                <CardContent>
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
                          disabled={loading}
                          className="min-w-[120px] h-12 mt-auto"
                        >
                          {loading ? (
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

                      {error && (
                        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
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
                        <img src={fileURL || "/placeholder.svg"} alt="Featured" className="w-full h-auto" />
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-primary" />
                            Selected
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

