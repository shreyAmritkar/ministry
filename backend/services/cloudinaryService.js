// ============================================
// services/cloudinaryService.js
// ============================================
const cloudinary = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');

class CloudinaryService {
    async uploadImage(fileBuffer, folder = 'reports') {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `civictrack/${folder}`,
                    resource_type: 'image',
                    transformation: [
                        { width: 1200, height: 1200, crop: 'limit' },
                        { quality: 'auto:good' }
                    ]
                },
                (error, result) => {
                    if (error) reject(new ApiError('Image upload failed', 500));
                    else resolve({
                        url: result.secure_url,
                        cloudinaryId: result.public_id
                    });
                }
            );

            uploadStream.end(fileBuffer);
        });
    }

    async uploadVideo(fileBuffer, folder = 'reports') {
        // For short videos (< 100MB), use Cloudinary
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `civictrack/${folder}`,
                    resource_type: 'video',
                    chunk_size: 6000000 // 6MB chunks
                },
                (error, result) => {
                    if (error) reject(new ApiError('Video upload failed', 500));
                    else resolve({
                        url: result.secure_url,
                        cloudinaryId: result.public_id,
                        duration: result.duration
                    });
                }
            );

            uploadStream.end(fileBuffer);
        });
    }

    async deleteMedia(cloudinaryId) {
        try {
            await cloudinary.uploader.destroy(cloudinaryId);
            return true;
        } catch (error) {
            throw new ApiError('Failed to delete media', 500);
        }
    }
}

module.exports = new CloudinaryService();